const express = require('express');
const {
    MongoClient
} = require('mongodb');
const cors = require('cors');
const formData = require('express-form-data');
var ObjectId = require('mongodb').ObjectID;
// const fileUpload = require("express-fileupload");
var fs = require('fs-extra')
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}))
app.use(formData.parse());
app.use('/files', express.static('files'));
// app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@assignment12.f8aci.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


async function run() {
    try {
        await client.connect();
        console.log('DB connected.');

        const database = client.db("assigment12");
        const users = database.collection("users");
        const events = database.collection("events");
        const carts = database.collection("carts");
        const products = database.collection("products");
        const orders = database.collection("orders");
        const reviews = database.collection("reviews");

        app.get('/products', async (req, res) => {
            const cursor = products.find().limit(+req.query.limit).sort({
                "_id": -1
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        app.get('/all-products', async (req, res) => {
            const cursor = products.find().sort({
                "_id": -1
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        app.get('/delete-product/:id', async (req, res) => {
            const query = {
                _id: ObjectId(req.params.id)
            }
            const result = await products.deleteOne(query);
            res.json(result);
        })

        app.post('/create-product', async (req, res) => {
            let form_data = {
                ...req.body
            };
            form_data.image = '';
            form_data.features = [];
            form_data.ratings = [];

            if (req.files) {
                const file = req.files.image;
                let file_name = parseInt(Math.random() * 100000000) + file.name;
                const path = __dirname + "/files/products/" + file_name;
                fs.move(file.path, path, function (err) {
                    if (err) return console.error(err)
                    console.log("success!")
                })
                form_data.image = "files/products/" + file_name;
            }
            const result = await products.insertOne(form_data);
            // console.log(form_data, result);
            // console.log(req.body, req.files);
            res.send(form_data);
        })

        app.get('/all-reviews', async (req, res) => {
            const cursor = reviews.find().limit(6).sort({
                "_id": -1
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        app.get('/all-orders', async (req, res) => {
            const cursor = orders.find().sort({
                "_id": -1
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        // all users
        app.get('/all-users', async (req, res) => {
            const cursor = users.find().sort({
                "_id": -1
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        // make admin 
        app.get('/accept-admin/:id', async (req, res) => {
            const query = {
                _id: ObjectId(req.params.id)
            }
            const result = await users.updateOne(query, {
                "$set": {
                    role: 'admin'
                }
            });
            res.json(result);
        })

        // search product
        app.get('/product/:id', async (req, res) => {
            const cursor = products.findOne({
                _id: ObjectId(req.params.id)
            });
            const results = await cursor;
            // console.log(results);
            res.json(results);
        })

        app.get('/users', async (req, res) => {
            const cursor = users.find();
            const results = await cursor.toArray();
            res.send([results, cursor, 'hi']);
        })

        // cart routes
        app.get('/carts', async (req, res) => {
            const cursor = carts.find({
                email: req.query.email
            });
            const results = await cursor.toArray();
            res.json(results);
        })

        app.get('/my-cart/:email', async (req, res) => {
            const cursor = carts.find({
                email: req.params.email
            });
            const results = await cursor.toArray();
            // console.log(results);
            res.json(results);
        })

        app.delete('/delete-cart/:id', async (req, res) => {
            const query = {
                _id: ObjectId(req.params.id)
            }
            const result = await carts.deleteOne(query);
            res.json(result);
        })

        // update cart
        app.post('/update-cart/:id', async (req, res) => {
            let form_data = {
                ...req.body
            };
            const query = {
                _id: ObjectId(req.params.id)
            }
            const result = await carts.updateOne(query, {
                "$set": {
                    qty: form_data.qty
                }
            });
            console.log(form_data);
            res.json(result);
        })

        // accept order
        app.get('/accept-order/:id', async (req, res) => {
            const query = {
                _id: ObjectId(req.params.id)
            }
            const result = await orders.updateOne(query, {
                "$set": {
                    status: 'accepted'
                }
            });
            res.json(result);
        })

        // save cart
        app.post('/cart', async (req, res) => {
            let form_data = {
                ...req.body
            };
            form_data.product_id = form_data._id;
            delete form_data._id;

            const cursor = carts.findOne({
                $and: [{
                        product_id: form_data.product_id
                    },
                    {
                        email: form_data.email
                    },
                ]
            });
            const check = await cursor;

            if (!check) {
                const result = await carts.insertOne(form_data);
            } else {
                const result = await carts.updateOne({
                    _id: check._id,
                }, {
                    "$set": form_data
                });
            }
            // console.log(form_data, result._id);
            // console.log(check);
            res.json(form_data);
        })

        // Save Order
        app.post('/order-create', async (req, res) => {
            let form_data = {
                ...req.body
            };

            // retrive all cart
            let cursor = carts.find({
                email: form_data.user_email
            });
            let cart_products = await cursor.toArray();
            form_data.products = cart_products;
            form_data.status = 'pending';
            form_data.created_at = new Date().toDateString();

            // save to order table
            await orders.insertOne(form_data);

            // delete all cart
            const query = {
                email: form_data.user_email
            }
            await carts.deleteMany(query);

            // again fetch cart products
            cursor = carts.find({
                email: form_data.user_email
            });
            cart_products = await cursor.toArray();

            // console.log(form_data, result._id);
            // console.log(check);
            res.json({
                form_data,
                cart_products
            });
        })

        // get all user order
        app.get('/orders', async (req, res) => {
            const cursor = orders.find({
                user_email: req.query.email
            });
            const results = await cursor.toArray();
            res.json(results);
        })
        app.get('/order-details/:id', async (req, res) => {
            console.log(req.params.id);
            const cursor = orders.findOne({
                _id: ObjectId(req.params.id)
            });
            const results = await cursor;
            res.json(results);
        })

        // register user
        app.post('/user-register', async (req, res) => {
            let form_data = {
                ...req.body
            };

            form_data.displayName = form_data.first_name + ' ' + form_data.last_name;
            form_data.role = 'user';
            form_data.photoURL = 'files/users/user.png';

            // form_data.product_id = form_data._id;
            // delete form_data._id;

            const cursor = users.findOne({
                $and: [{
                    email: form_data.email
                }, ]
            });
            const check = await cursor;
            let result = {}

            if (!check) {
                result = await users.insertOne(form_data);
                form_data._id = result.insertedId;
            } else {
                result = await users.updateOne({
                    _id: check._id,
                }, {
                    "$set": form_data
                });
                form_data._id = check._id;
            }
            // console.log(form_data, result._id);
            console.log(check, result?.insertedId);
            res.json(form_data);
        })

        app.post('/user-login', async (req, res) => {
            let form_data = {
                ...req.body
            };

            const cursor = users.findOne({
                $and: [{
                        password: form_data.password
                    },
                    {
                        email: form_data.email
                    },
                ]
            });
            const check = await cursor;

            if (check) {
                res.json(check);
            } else {
                res.json(false);
            }

            console.log(check);
        })

        // Save Review
        app.post('/save-review', async (req, res) => {
            let form_data = {
                ...req.body
            };
            form_data.rating = parseInt(form_data.rating);
            form_data.user_details = JSON.parse(form_data.user_details);

            // retrive all cart
            let cursor = products.findOne({
                _id: ObjectId(form_data.product_id)
            });
            let product = await cursor;

            // update review or product
            let ratings = [...product.ratings];
            ratings.push(form_data);

            products.updateOne({
                _id: ObjectId(form_data.product_id)
            }, {
                "$set": {
                    ratings: ratings
                }
            });

            // retrive updated product 
            cursor = products.findOne({
                _id: ObjectId(form_data.product_id)
            });
            product = await cursor;

            // save to review table
            await reviews.insertOne(form_data);

            res.json({
                form_data,
                product
            });
        })

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('running node server');
})

app.listen(port, () => {
    console.log('server started on. ' + port);
})