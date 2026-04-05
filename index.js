const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

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

const uri = `mongodb+srv://${process.env.db_user}:${process.env.keyDb}@cluster0.vhv77.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "⚡️ Great! pinged your deployment. You successfully connected to MongoDB🔥"
    );

    const users = client.db("volunteerCorner").collection("users");
    const volunteerJobs = client
      .db("volunteerCorner")
      .collection("volunteerJobs");
    const jobApplications = client
      .db("volunteerCorner")
      .collection("jobApplications");

    // create users
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const result = await users.insertOne(userInfo);
      res.send(result);
    });

    // Create All Volunteer jobs ...(POST — Create)
    app.post("/jobs", async (req, res) => {
      const job = req.body;
      const result = await volunteerJobs.insertOne(job);
      res.send(result);
    });

    //.................require('crypto').randomBytes(64).toString('hex')................
    // #..................................Auth related APIs#............................
    //..................................................................................
    app.post("/jwt", (req, res) => {
      // const email = req.body;
      // const token = jwt.sign({ email }, process.env.TOKEN_SECRECT_KEY, {
      //   expiresIn: "10hr",
      const user= req.body;
      const token = jwt.sign(user , process.env.TOKEN_SECRECT_KEY , {expiresIn:'10hr'});
       
   
      res.cookie('token' , token , {
        httpOnly: true,
        secure: false,
      })
      .send({success: true})
    }); 

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          secure:false,
          //sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          
        })
        .send({ success: true });
    });

    // GET — Read (data fetch to see data on browser)
    app.get("/jobs", async (req, res) => {
      const result = await volunteerJobs.find().toArray();
      res.send(result);
    });

    // GET - Read (specific job -- to view job details)
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerJobs.findOne(query);
      res.send(result);
    });

    //.....................Job application.....................................
    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplications.insertOne(application);
      res.send(result);
    });

    // GET — Read (data fetch to see data on browser)
    app.get("/job-applications", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;
        console.log(req.cookies?.token);
        if(req.user.email !== req.query.email){
          return res.status(403).send({message: 'forbidden access!'});
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
        res.status(500).send({ message: "server error" });
      }
    });

    // Delete a job application by user
    app.delete("/job-applications/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await jobApplications.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Votuneer are requested to apply!");
});
app.listen(port, () => {
  console.log(`Volunteer server is running on port ${port}`);
});
