require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000

// middlewares
app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vahgs6d.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();

    const eventsCollection = client.db("EventsDB").collection("events");

    // get all the events based on user's email
    app.get("/events", async(req, res)=>{
        // const email = req.query.email;
        const query = {};
        const result = await eventsCollection.find(query).toArray();
        res.send(result);
    });

    // save the event into the database
    app.post("/events", async(req, res)=>{
        const event = req.body;
        const result = await eventsCollection.insertOne(event);
        res.send(result);
    });

    // update a event in database
    app.patch("/events/:id", async(req, res)=>{
        const id = req.params.id;
        const event = req.body;

        const query = {_id: new ObjectId(id)};
        
        const updateDoc = {
            $set: {
                name: event.name,
                description: event.description,
                image: event.image,
                date: event.date,
                time: event.time,
                location: event.location,
                category: event.category,
                tickets: event.tickets
            }
        }

        const result = await eventsCollection.updateOne(query, updateDoc);
        res.send(result);
    });

    // delete from the database
    app.delete("/events/:id", async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await eventsCollection.deleteOne(query);
        res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res)=>{
    res.send("server running in localhost");
});

app.listen(port, ()=>{
    console.log(`visit http://localhost:${port}`);
})