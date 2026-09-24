const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();

// Always true on Vercel, false on localhost
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// ---------------- MIDDLEWARE ----------------
app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "https://volunteer-client-phi.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
      ];
      if (!origin || allowed.includes(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());

// ---------------- COOKIE OPTIONS ----------------
const cookieOptions = {
  httpOnly: true,
  secure: isVercel,
  sameSite: isVercel ? "none" : "lax",
  maxAge: 10 * 60 * 60 * 1000,
  path: "/",
};

// ---------------- JWT ROUTE ----------------
app.post("/jwt", (req, res) => {
  try {
    const user = req.body;

    if (!user || !user.email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const token = jwt.sign({ email: user.email }, process.env.TOKEN_SECRECT_KEY, {
      expiresIn: "10hr",
    });

    res.cookie("token", token, cookieOptions).send({ success: true, token });
  } catch (error) {
    console.error("JWT Error:", error);
    res.status(500).send({ message: "Error creating token", error: error.message });
  }
});

// ---------------- LOGOUT ROUTE ----------------
app.post("/logout", (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: isVercel,
      sameSite: isVercel ? "none" : "lax",
      path: "/",
    })
    .send({ success: true });
});

// ---------------- AUTH MIDDLEWARE ----------------
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access!!" });
  }
  jwt.verify(token, process.env.TOKEN_SECRECT_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access!!" });
    }
    req.user = decoded;
    next();
  });
};

// ---------------- MONGODB (CACHED) ----------------
const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_password}@cluster0.vhv77.mongodb.net/?appName=Cluster0`;

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  console.log("Connected to MongoDB!");
  cachedDb = client.db("volunteerCorner");
  return cachedDb;
}

// ---------------- ROUTES ----------------

// Root check
app.get("/", (req, res) => {
  res.send("Volunteer server is running!");
});

// Create user
app.post("/users", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("users").insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send({ message: "Error creating user" });
  }
});

// Create job
app.post("/jobs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("volunteerJobs").insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).send({ message: "Error creating job" });
  }
});

// Get all jobs
app.get("/jobs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const sort = req.query?.sort;
    let sortQuery = {};
    if (sort === "true") {
      sortQuery = { "salary.min": -1 };
    }
    const result = await db
      .collection("volunteerJobs")
      .find({})
      .sort(sortQuery)
      .toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).send({ message: "Error fetching jobs" });
  }
});

// Get specific job
app.get("/jobs/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db
      .collection("volunteerJobs")
      .findOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).send({ message: "Error fetching job" });
  }
});

// Create job application
app.post("/job-applications", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("jobApplications").insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error("Error creating application:", error);
    res.status(500).send({ message: "Error creating application" });
  }
});

// Get job applications for a user
app.get("/job-applications", verifyToken, async (req, res) => {
  try {
    if (req.user.email !== req.query.email) {
      return res.status(403).send({ message: "forbidden access!" });
    }

    const db = await connectToDatabase();
    const result = await db
      .collection("jobApplications")
      .aggregate([
        { $match: { applicant_email: req.user.email } },
        { $addFields: { jobIdObj: { $toObjectId: "$job_id" } } },
        {
          $lookup: {
            from: "volunteerJobs",
            localField: "jobIdObj",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        { $unwind: "$jobInfo" },
        {
          $project: {
            title: "$jobInfo.title",
            category: "$jobInfo.category",
            location: "$jobInfo.location",
            salary: "$jobInfo.salary",
            deadline: "$jobInfo.deadline",
            applicant_email: 1,
            job_id: 1,
          },
        },
      ])
      .toArray();

    res.send(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send({ message: "server error" });
  }
});

// Delete job application
app.delete("/job-applications/:id", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db
      .collection("jobApplications")
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).send({ message: "Error deleting application" });
  }
});

// ---------------- LOCAL DEV LISTEN ----------------
if (!isVercel) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Volunteer server is running on port ${port}`);
  });
}

module.exports = app;