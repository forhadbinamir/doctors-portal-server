const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.use(cors())
app.use(express.json())

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded
        console.log(decoded)
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4ibwc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect()
    try {
        const databaseCollection = client.db("doctor_portal").collection("service");
        const bookingCollection = client.db("doctor_portal").collection("booking");
        const userCollection = client.db("doctor_portal").collection("users");
        const doctorsCollection = client.db("doctor_portal").collection("doctor");

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {

            const service = req.body
            const price = service.price
            const amount = price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        }
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorsCollection.find().toArray()
            res.send(doctors)
        })
        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const query = req.body
            const result = await doctorsCollection.insertOne(query)
            res.send(result)
        })
        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await doctorsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const query = {}
            const cursor = userCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result })
        })

        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date
            //step: 1 to get all array
            const services = await databaseCollection.find().toArray()
            //step: 2 get the booking of that day
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()
            //step: 3 for each service,

            services.forEach(service => {
                //step: find booking for that service
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                //step: 5 select slots for the service booking 
                const bookedSlots = serviceBookings.map(book => book.slot)
                // console.log(bookedSlots)
                //step: 6 select those slot that are not in book slot
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))

                //step: set available to slots make it easier    
                service.slots = available

            })
            res.send(services)
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient
            const decodedEmail = req.decoded.email
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                res.send(bookings)
            } else {
                return res.status(403).send({ message: 'Forbidden access' })
            }

        })

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = databaseCollection.find(query).project({ name: 1 })
            const result = await cursor.toArray()
            res.send(result)
        })
    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Doctors portal server is running !')
})

app.listen(port, () => {
    console.log(`Doctors portal port is running ${port}`)
})