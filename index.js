require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const SSLCommerzPayment = require("sslcommerz-lts");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

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
    },
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
//sssl commerze
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const eventsCollection = client.db("EventsDB").collection("events");
        const usersCollection = client.db("EventsDB").collection("users");
        const messagesCollection = client.db("EventsDB").collection("messages");
        const likedCollection = client.db("EventsDB").collection("likedEvents")
        const paymentCollection = client.db("EventsDB").collection("payments")
        const feedbackCollection = client.db("EventsDB").collection("feedbacks")

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

        app.get("/events/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
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
                    eventName: event.eventName,
                    eventDescription: event.eventDescription,
                    imageUrl: event.imageUrl,
                    eventDate: event.eventDate,
                    eventTime: event.eventTime,
                    eventLocation: event.eventLocation,
                    eventCategory: event.eventCategory,
                    ticketAvailable: event.ticketAvailable,
                    ticketPrice: event.ticketPrice
                }
            }

            const result = await eventsCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.patch("/update-event/:id", async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            const query = { _id: new ObjectId(id) };

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
            try {
                let pageSize = req.query.pageSize;
                pageSize = parseInt(pageSize) || 10

                const page = req.query.currentPage || 1;

                if (isNaN(pageSize) || isNaN(page)) {
                    return res.status(400).json({ error: "Invalid pagination parameters" });
                }

                const skipItems = (page - 1) * pageSize;
                const filter = {};

                if (req.query.role && req.query.role !== 'null') {
                    filter.role = req.query.role;
                }

                const result = await usersCollection.find(filter).skip(skipItems).limit(pageSize).toArray();

                // Get total count for pagination metadata
                const totalCount = await usersCollection.countDocuments(filter);
                res.json({ items: result, totalPages: Math.ceil(totalCount / pageSize) });

            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).json({ error: "Server error" });
            }
        });

        // get a single user data
        app.get("/users/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        app.get("/users/role/:email", async (req, res) => {
            const email = req.params.email;
            // if(req.decoded.email !== email){
            //   res.send({role: null})
            // }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { role: user?.role }
            res.send(result);
        });

        app.patch("/users/:id", async (req, res) => {
            const id = req.params.id;
            const role = req.query.role;
            const query = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: role
                }
            }

            const result = await usersCollection.updateOne(query, updateDoc);
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
            const user = req.body; 

            try {
                
                const existingUser = await likedCollection.findOne({ username: user.email });

                if (existingUser) {
                    
                    await likedCollection.updateOne(
                        { username: user.email },
                        { $set: { likedEvents: user.likedEvents } }
                    );
                } else {
                    
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
        });
        // get all favorite
        app.get(`/allLiked`, async (req, res) => {
            const result = await likedCollection.find().toArray()
            res.send(result)
        });
        // get all favorites in array
        app.get("/allLikedEventIds", async (req, res) => {
            try {
              const allLikedEvents = await likedCollection.find().toArray();
          
              let allEventIds = [];
          
              allLikedEvents.forEach(userLikedEvents => {
                if (userLikedEvents.likedEvents && userLikedEvents.likedEvents.length > 0) {
                  allEventIds = allEventIds.concat(userLikedEvents.likedEvents);
                }
              });
          
              res.json({ allEventIds });
            } catch (err) {
              console.error('Error:', err);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });
        // delete from favorite
        app.delete('/deleteFavEvent/:username/:eventId', async (req, res) => {
            try {
              const username = req.params.username;
              const eventId = req.params.eventId;
          
              // Update the document in the collection
              const result = await likedCollection.updateOne(
                { username: username },
                { $pull: { likedEvents: eventId } }
              );
          
              if (result.modifiedCount > 0) {
                res.status(200).json({ success: true, message: 'Event deleted successfully.' });
              } else {
                res.status(404).json({ success: false, message: 'User or event not found.' });
              }
            } catch (error) {
              console.error(error);
              res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
          });
        // tranx_id
        const tranx_id = new ObjectId().toString();
        //payment api
        app.post("/order", async (req, res) => {
            const event = await eventsCollection.findOne({
                _id: new ObjectId(req.body.eventId),
            });


            const order = req.body;
            const price = parseFloat(event.ticketPrice);
            //console.log(price);
            const data = {
                total_amount: price,
                currency: order.currency,
                tran_id: tranx_id, // use unique tran_id for each api call
                success_url: `https://server-event-management-iota.vercel.app/payments/success/${tranx_id}`,
                fail_url: `https://server-event-management-iota.vercel.app/payments/fail/${tranx_id}`,
                cancel_url: "https://server-event-management-iota.vercel.app/cancel",
                ipn_url: "https://server-event-management-iota.vercel.app/ipn",
                shipping_method: "Courier",
                product_name: event.eventName,
                product_category: "Tickets",
                product_profile: "general",
                cus_name: order.name,
                cus_email: order.email,
                cus_add1: "Dhaka",
                cus_add2: "Dhaka",
                cus_city: "Dhaka",
                cus_state: "Dhaka",
                cus_postcode: "1000",
                cus_country: "Bangladesh",
                cus_phone: order.phone,
                cus_fax: "01711111111",
                ship_name: "Customer Name",
                ship_add1: "Dhaka",
                ship_add2: "Dhaka",
                ship_city: "Dhaka",
                ship_state: "Dhaka",
                ship_postcode: 1000,
                ship_country: "Bangladesh",
            };
            //console.log(data)
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
            sslcz.init(data).then((apiResponse) => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL;
                res.send({ url: GatewayPageURL });
                const finalPayment = {
                    event,
                    paidStatus: false,
                    tranjectionId: tranx_id,
                    email: order.email
                };
                const result = paymentCollection.insertOne(finalPayment);
                //console.log("Redirecting to: ", GatewayPageURL);
            });
            app.post("/payments/success/:trx_Id", async (req, res) => {
                console.log(req.params.trx_Id);
                const result = await paymentCollection.updateOne(
                    { tranjectionId: req.params.trx_Id },
                    {
                        $set: {
                            paidStatus: true,
                        },
                    }
                );
                if (result.modifiedCount > 0) {
                    res.redirect(
                        `https://event-management-nu.vercel.app/dashboard/payments/success/${req.params.trx_Id}`
                    );
                }
            });
            app.post("/payments/fail/:trx_Id", async (req, res) => {
                const result = await paymentCollection.deleteOne({ tranjectionId: req.params.trx_Id })
                if (result.deletedCount) {
                    res.redirect(
                        `https://event-management-nu.vercel.app/dashboard/payments/fail/${req.params.trx_Id}`
                    );
                }
            })
        });

        // ********sadia********//
        // get payment
        app.get("/payments",async (req,res)=>{
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })
        app.get("/getPaidStatusCount",async (req,res)=>{
            const trueCount = await paymentCollection.countDocuments({paidStatus:true});
            const falseCount = await paymentCollection.countDocuments({paidStatus:false});
            console.log(trueCount);
            console.log(falseCount);

            res.send({trueCount,falseCount});
        })

        //registered events api and payment history
        app.get("/payments/registeredevents", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            //console.log(result)
            res.send(result);
        });

        app.get("/testimonial", async (req, res)=>{
            const status = req.query.status;
            const query = {status};
            const result = await feedbackCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/feedback", async (req, res)=>{
            const query = {};
            const result = await feedbackCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/feedback/:id", async (req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await feedbackCollection.findOne(query);
            res.send(result);
        })

        app.post("/feedback", async (req, res)=>{
            const feedback = req.body;
            const result = await feedbackCollection.insertOne(feedback);
            res.send(result);
        });

        app.patch("/feedback/:id", async (req, res)=>{
            const id = req.params.id;
            const status = req.query.status;
            const query = {_id: new ObjectId(id)};
            const updateDoc = {
                $set: {
                    status
                }
            }
            const result = await feedbackCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.delete("/feedback/:id", async (req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await feedbackCollection.deleteOne(query);
            res.send(result);
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
