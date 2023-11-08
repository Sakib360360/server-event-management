require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000

// middlewares
app.use(express.json());
app.use(cors());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized! access denied" });
    }

    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized! access denied" });
        }
        req.decoded = decoded;
        next();
    });
}


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
        await client.connect();

        const eventsCollection = client.db("EventsDB").collection("events");
        const usersCollection = client.db("EventsDB").collection("users");
        const messagesCollection = client.db("EventsDB").collection("messages");
        const likedCollection = client.db("EventsDB").collection("likedEvents")
        const paymentCollection = client.db("EventsDB").collection("payment")

        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
            res.send({ token });
        });

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "Forbidden! access denied" });
            }
            next()
        }

        const verifyOrganizer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "organizer") {
                return res.status(403).send({ error: true, message: "Forbidden! access denied" });
            }
            next()
        }

        const verifyAttendee = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "attendee") {
                return res.status(403).send({ error: true, message: "Forbidden! access denied" });
            }
            next()
        }

        // get data from database
        app.get("/all-events", async (req, res) => {
            try {
                let pageSize = req.query.pageSize;
                pageSize = parseInt(pageSize) || 10

                const page = req.query.currentPage || 1;

                if (isNaN(pageSize) || isNaN(page)) {
                    return res.status(400).json({ error: "Invalid pagination parameters" });
                }

                const skipItems = (page - 1) * pageSize;
                const filter = {};

                if (req.query.status && req.query.status !== 'null') {
                    filter.eventStatus = req.query.status;
                }

                const result = await eventsCollection.find(filter).skip(skipItems).limit(pageSize).toArray();

                // Get total count for pagination metadata
                const totalCount = await eventsCollection.countDocuments(filter);
                res.json({ items: result, totalPages: Math.ceil(totalCount / pageSize) });

            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).json({ error: "Server error" });
            }
        });

        // get all the events based on user's email
        app.get("/events", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await eventsCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/events/:id", async (req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await eventsCollection.findOne(query);
            res.send(result);
        })

        // save the event into the database
        app.post("/events", async (req, res) => {
            const event = req.body;
            const result = await eventsCollection.insertOne(event);
            res.send(result);
        });

        // update a event in database
        app.patch("/events/:id", async (req, res) => {
            const id = req.params.id;
            const event = req.body;

            const query = { _id: new ObjectId(id) };

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

        app.patch("/update-event/:id", async (req, res)=>{
            const id = req.params.id;
            const status = req.query.status;
            const query = {_id: new ObjectId(id)};

            const updateDoc = {
                $set: {
                    eventStatus: status
                }
            }

            const result = await eventsCollection.updateOne(query, updateDoc);
            res.send(result);
        })


        // delete from the database
        app.delete("/events/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await eventsCollection.deleteOne(query);
            res.send(result);
        });


        // save user into the database
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const userExists = await usersCollection.findOne(query);

            if (userExists) {
                return res.send({ message: "user already exists" });
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        // get all the users from database
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });


        // get user message
        app.get("/messages", async (req, res) => {
            const query = {};
            const options = {
                sort: { "date": -1 }
            }
            const result = await messagesCollection.find(query, options).toArray();
            res.send(result);
        });

        // get a single message
        app.get("/messages/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await messagesCollection.findOne(query);
            res.send(result);
        });

        // post a message
        app.post("/messages", async (req, res) => {
            const message = req.body;
            const result = await messagesCollection.insertOne(message);
            res.send(result);
        });

        app.patch("/messages", async (req, res) => {
            const query = { status: "unseen" };

            const updateDoc = {
                $set: {
                    status: "seen"
                }
            }

            const result = await messagesCollection.updateMany(query, updateDoc);
            res.send(result);
        });

        // update a message
        app.patch("/messages/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const updateDoc = {
                $set: {
                    status: "seen"
                }
            }

            const result = await messagesCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        // delete a message
        app.delete("/messages/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await messagesCollection.deleteOne(query)
            res.send(result);
        });

        //   save to favorite
        app.post('/addToLiked', async (req, res) => {
            const user = req.body; // Assuming the user object is sent in the request body

            try {
                // Check if the user already exists in the favorites collection
                const existingUser = await likedCollection.findOne({ username: user.email });

                if (existingUser) {
                    // User already exists, update the entire document
                    await likedCollection.updateOne(
                        { username: user.email },
                        { $set: { likedEvents: user.likedEvents } }
                    );
                } else {
                    // User doesn't exist, create a new document
                    await likedCollection.insertOne({
                        username: user.email,
                        likedEvents: user.likedEvents,
                    });
                }

                res.send({ message: 'User added successfully' });
            } catch (error) {
                console.error('Error adding user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // get favorite
        app.get(`/liked/:email`, async (req, res) => {
            const email = req.params.email;
            const query = { username: email }
            const result = await likedCollection.find(query).toArray()
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("server running");
});

app.listen(port, () => {
    console.log(`visit http://localhost:${port}`);
})