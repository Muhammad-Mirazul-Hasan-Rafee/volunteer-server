const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//environment flag — true on Vercel, false on localhost
const isProduction = process.env.NODE_ENV === "production";


// middleware
app.use(express.json());
app.use(
  cors({
    // allow all .vercel.app domains + localhost
    origin: (origin,callback)=>{
      const allowed =[
      "https://volunteer-client-phi.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
    ];
    if (
        !origin ||
        allowed.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);


app.use(cookieParser());
// ---------- COOKIE OPTIONS ----------
//reusable cookie options that adapt to prod vs dev
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,                   // true on Vercel (HTTPS), false on localhost
  sameSite: isProduction ? "none" : "lax", // 'none' needed for cross-domain in prod
  maxAge: 10 * 60 * 60 * 1000,
  path: "/",
};

//..................JWT route..............
app.post("/jwt", (req, res) => {
  try {
    const user = req.body;
    console.log("JWT request for:", user);
     console.log("SECRET VALUE:", process.env.TOKEN_SECRECT_KEY);
    
    if (!user || !user.email) {
      return res.status(400).send({ message: "Email is required" });
    }
    
    const token = jwt.sign(
      { email: user.email }, 
      process.env.TOKEN_SECRECT_KEY, 
      { expiresIn: '10hr' }
    );
    
    //use cookieOptions
    res.cookie("token", token, cookieOptions).send({ success: true, token });
  } catch (error) {
    console.error("JWT Error:", error);
    res.status(500).send({ message: "Error creating token", error: error.message });
  }
});

//............Logout route.............

app.post("/logout", (req, res) => {
   //use same cookie options (minus maxAge) to clear properly
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
     sameSite: isProduction ? "none" : "lax",
    path: '/',
  }).send({ success: true });
});

// custom middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("TOKEN:", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access!!" });
  }
  // verify token
  jwt.verify(token, process.env.TOKEN_SECRECT_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access!!" });
    }
    req.user = decoded;
    next();
  });
};

// ---------- MONGODB (CACHED CONNECTION) ----------

const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_password}@cluster0.vhv77.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected to MongoDB!");
    
    const users = client.db("volunteerCorner").collection("users");
    const volunteerJobs = client.db("volunteerCorner").collection("volunteerJobs");
    const jobApplications = client.db("volunteerCorner").collection("jobApplications");

    // create users
    app.post("/users", async (req, res) => {
      try {
        const userInfo = req.body;
        const result = await users.insertOne(userInfo);
        res.send(result);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).send({ message: "Error creating user" });
      }
    });

    // Create All Volunteer jobs
    app.post("/jobs", async (req, res) => {
      try {
        const job = req.body;
        const result = await volunteerJobs.insertOne(job);
        res.send(result);
      } catch (error) {
        console.error("Error creating job:", error);
        res.status(500).send({ message: "Error creating job" });
      }
    });

    // GET jobs
    app.get("/jobs", async (req, res) => {
      try {
        const sort = req.query?.sort;
        let sortQuery = {};
        if (sort == "true" || sort === true) {
          sortQuery = { "salary.min": -1 };
        }
        const cursor = volunteerJobs.find({}).sort(sortQuery);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).send({ message: "Error fetching jobs" });
      }
    });

    // GET specific job
    app.get("/jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await volunteerJobs.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error fetching job:", error);
        res.status(500).send({ message: "Error fetching job" });
      }
    });

    // Job application
    app.post("/job-applications", async (req, res) => {
      try {
        const application = req.body;
        const result = await jobApplications.insertOne(application);
        res.send(result);
      } catch (error) {
        console.error("Error creating application:", error);
        res.status(500).send({ message: "Error creating application" });
      }
    });

    // GET job applications
    app.get("/job-applications", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;
        console.log("User email:", email);
        console.log("Query email:", req.query.email);
        
        if (req.user.email !== req.query.email) {
          return res.status(403).send({ message: 'forbidden access!' });
        }

        const result = await jobApplications
          .aggregate([
            {
              $match: { applicant_email: email },
            },
            {
              $addFields: {
                jobIdObj: { $toObjectId: "$job_id" },
              },
            },
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

    // Delete a job application by user
    app.delete("/job-applications/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await jobApplications.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error deleting application:", error);
        res.status(500).send({ message: "Error deleting application" });
      }
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Volunteer server is running!");
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Volunteer server is running on port ${port}`);
  });
}

module.exports = app;