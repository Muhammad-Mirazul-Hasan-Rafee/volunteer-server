const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware
app.use(express.json());
app.use(cors());



const uri = `mongodb+srv://${process.env.db_user}:${process.env.keyDb}@cluster0.vhv77.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("⚡️ Great! pinged your deployment. You successfully connected to MongoDB🔥");

    const users =client.db('volunteerCorner').collection('users');
    const volunteerJobs = client.db('volunteerCorner').collection('volunteerJobs');
   

       // create users
    app.post('/users' , async(req , res)=>{
      const userInfo = req.body;
      const result = await users.insertOne(userInfo);
      res.send(result);

    });


    // Create All Volunteer jobs ...(POST — Create)
    app.post('/jobs' , async(req, res)=>{
      const job = req.body;
      const result = await volunteerJobs.insertOne(job);
      res.send(result);

    });
   
    // GET — Read (data fetch to see data on browser)
    app.get('/jobs' , async(req , res)=>{
      const email = req.query.email;
      let query = {};
      if(email){
        query = {organizerEmail: email};
      }
      const cursor = volunteerJobs.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
 
    // GET - Read (specific job -- to view job details)
    app.get('/jobs/:id' , async(req , res)=>{
      const id= req.params.id;
      const query = {_id: new ObjectId(id)};
      const cursor =  volunteerJobs.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });


    
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/' , (req , res)=>{
    res.send('Votuneer are requested to apply!');
});
app.listen(port ,()=>{
    console.log(`Volunteer server is running on port ${port}`);
}
)






