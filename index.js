

import shortURl from "node-url-shortener"
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv"
import { auth } from "./middleware/auth.js";
import nodemailer from "nodemailer"
import { resetauth } from "./middleware/resetauth.js";
dotenv.config()

const app = express();
// const MONGO_URL = "mongodb://127.0.0.1";
const client = new MongoClient(process.env.MONGO_URL)
await client.connect()

console.log("Mongo is connected")
app.use(express.json())
app.use(cors())
const PORT = process.env.PORT;

app.post("/signup", async function (request, response) {
    const { username, password, email } = request.body
    const isSCheck = await client.db("urlshortener").collection("signupusers").findOne({ username: username })
    const isSCheckE = await client.db("urlshortener").collection("signusers").findOne({ email: email })
    const isCheck = await client.db("urlshortener").collection("login").findOne({ username: username })
    const isCheckE = await client.db("urlshortener").collection("login").findOne({ email: email })


    if (!isCheck && !isCheckE && !isSCheck && !isSCheckE) {

        const Hashedpassword = await Hashed(password)
        async function Hashed(password) {
            const NO_OF_ROUNDS = 10
            const salt = await bcrypt.genSalt(NO_OF_ROUNDS)
            const HashedPassword = await bcrypt.hash(password, salt)
            return HashedPassword
        }
        let tempLink = ""
        const character = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789"
        const characters = character.length
        for (let i = 0; i < 60; i++) {
            tempLink += character.charAt(Math.floor(Math.random() * characters))

        }

        let finalData = {
            username: username,
            password: Hashedpassword,
            role_id: 0,
            email: email,
            verify_link: `https://lovely-alfajores-3b1c69.netlify.app/${username}/${tempLink}`
        }
        const insertData = await client.db("urlshortener").collection("signupusers").insertOne(finalData)
        if (insertData) {
            async function main(finalData) {
                let username = finalData.username;
                let email = finalData.email;
                let verify_link = finalData.verify_link

                let transporter = await nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_MAIL,
                        pass: process.env.SMTP_KEY,
                    },
                });
                let info = await transporter.sendMail({
                    from: '"urlshortener" <foo@example.com>', // sender address
                    to: `${email}`, // list of receivers
                    subject: "Verification link for Signin", // Subject line
                    text: "Hello world?", // plain text body
                    html: `Hi ${username} please click the below link to verify.
                    <div style="text-align:center;margin:45px">
                    <a rel="noopener" target="_blank" href=${verify_link} target="_blank"
                     style="font-size: 18px; font-family: Helvetica, Arial, sans-serif;
                     font-weight: bold; text-decoration: none;border-radius: 5px; 
                      padding: 12px 18px; border: 1px solid #1F7F4C;background-color: 
                    darkblue ;box-shadow:2px 2px 10px grey ;color:white;display: inline-block;">
                    Verify</a>
                    </div>
                    
                    `, // html body
                });


                console.log("Message sent: %s", info.messageId);

                console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
                response.send({ message: "sign verify sent" })


            }

            main(finalData).catch(console.error);

        }

    } else {
        response.send({ message: "sign fail" })
    }
})

app.get("/verify_link/:username/:id", async function (request, response) {
    const { username, id } = request.params
    const link = `https://lovely-alfajores-3b1c69.netlify.app/verify_link/${username}/${id}`
    const isCheck = await client.db("urlshortener").collection("signupusers").findOne({ verify_link: link })

    if (isCheck) {
        let checkData = {
            username: isCheck.username,
            password: isCheck.password,
            role_id: isCheck.role_id,
            email: isCheck.email,
            verify_link: isCheck.verify_link
        }
        const insertData = await client.db("urlshortener").collection("login").insertOne(checkData)

        if (insertData) {
            response.send({ message: "sign success" })
            await client.db("urlshortener").collection("userurls").insertOne({ username: username })

            client.db("urlshortener").collection("login").updateOne({ username: username }, { $unset: { verify_link: link } })
            client.db("urlshortener").collection("signupusers").updateOne({ username: username }, { $unset: { verify_link: link } })


        }

    } else {
        response.send({ message: "error" })
    }

})

app.post("/login", async function (request, response) {
    const data = request.body

    const loginData = await client.db("urlshortener").collection("login").findOne({ username: data.username })
    if (loginData) {

        async function comparPassword() {
            return bcrypt.compare(data.password, loginData.password);
        }
        const comparePassword = await comparPassword()
        if (comparePassword) {
            const token = jwt.sign({ _id: ObjectId(loginData._id) }, process.env.MY_KEY)
            response.send({ message: "successful login", token: token, role_id: loginData.role_id, email: loginData.email })
        }
    } else {
        response.send({ message: "error" })
    }

})



app.post("/forgetpassword", async function (request, response) {
    const { username, email } = request.body;
    const data = await client.db("urlshortener").collection("login").findOne({ username: username })
    if (data.username == username && data.email == email) {
        console.log("hello")
        let tempLink = ""
        const character = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789"
        const characters = character.length
        for (let i = 0; i < 40; i++) {
            tempLink += character.charAt(Math.floor(Math.random() * characters))

        }
        const otp = Math.floor(1000 + Math.random() * 9000)
        const otpData = {
            otp: otp,
            email: email,
            username: username,
            tempLink: `https://lovely-alfajores-3b1c69.netlify.app/verification-link/${username}/${tempLink}`,
        }
        console.log(otpData)
        const checkData = await client.db("urlshortener").collection("otp").findOne({ username: username })

        console.log(checkData)
        if (!checkData) {
            const otpInsertData = client.db("urlshortener").collection("otp").insertOne(otpData)

            const finalData = await client.db("urlshortener").collection("otp").findOne({ username: username })


            setTimeout(async () => {
                await client.db("urlshortener").collection("otp").deleteOne({ otp: otpData.otp })
            }, 120000);


            async function main(finalData) {

                // Generate test SMTP service account from ethereal.email
                // Only needed if you don't have a real mail account for testing
                let username = finalData.username;
                let otp = finalData.otp;
                let email = finalData.email;
                let tempLink = finalData.tempLink
                let testAccount = await nodemailer.createTestAccount();
                // create reusable transporter object using the default SMTP transport


                let transporter = await nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: process.env.port,
                    secure: false,
                    tls: {
                        rejectUnauthorized: false
                    },
                    auth: {
                        user: process.env.SMTP_MAIL,
                        pass: process.env.SMTP_KEY,
                    },
                });

                // send mail with defined transport object

                let info = await transporter.sendMail({
                    from: '"urlshortener" <foo@example.com>', // sender address
                    to: `${email}`, // list of receivers
                    subject: "Verification link", // Subject line
                    text: "Hello world?", // plain text body
                    html: `Hi ${username} your otp is <strong>${otp} </strong>it will expire in two minutes
                    please paste it in the following link ${tempLink}`, // html body
                });

                response.send({ message: "link sent" });

                console.log("Message sent: %s", info.messageId);
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

                // Preview only available when sending through an Ethereal account
                console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
                // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...

            }

            main(otpData).catch(console.error);

            ;

        }




    } else {
        response.send("error")
    }

    // async..await is not allowed in global scope, must use a wrapper

});


app.post("/verification-link/:username/:id", async function (request, response) {
    const { username, id } = request.params

    let data = request.body
    const otpData = await client.db("urlshortener").collection("otp").findOne({ username: username })

    if (parseInt(data.otp) == parseInt(otpData.otp)) {
        const token = jwt.sign({ _id: ObjectId(data._id) }, process.env.RESET_KEY)
        response.send({ message: "otp success", username: username, token: token })
    } else {
        response.send({ message: "error" })
    }

})

app.put("/password-change/:username", resetauth, async function (request, response) {
    let data = request.body
    const { username } = request.params



    const Hashedpassword = await Hashed(data.newpassword)
    async function Hashed(password) {
        const NO_OF_ROUNDS = 10
        const salt = await bcrypt.genSalt(NO_OF_ROUNDS)
        const HashedPassword = await bcrypt.hash(password, salt)
        return HashedPassword
    }
    let checkuser = await client.db("urlshortener").collection("login").updateOne({ username: username }, { $set: { password: Hashedpassword } })
    if (checkuser) {
        response.send({ message: "success" })
    } else if (response.status === 404) {
        response.send({ message: "error" })
    }





})

app.post("/urlshortener/:id", async function (request, response) {
    const data = request.body
    let { id } = request.params
    const userURL = await client.db("urlshortener").collection("userurls").findOne({ "urls.rurl": data.rurl })

    if (!userURL) {
        console.log("hello")
        console.log("l")
        shortURl.short(data.rurl, function (err, url) {
            client.db("urlshortener").collection("userurls").updateOne({ username: id }, {
                $push: {
                    urls: {
                        rurl: data.rurl,
                        surl: url
                    }
                }
            })
            response.send({ message: "success" })


        })
    } else {
        response.send({ message: "error" })
    }


})

app.get("/urlshortener/:id", auth, async function (request, response) {
    const { id } = request.params
    const userURL = await client.db("urlshortener").collection("userurls").findOne({ username: id }, {
        projection: {
            _id: 0,
            urls: 1
        }
    })
    response.send(userURL.urls)


})

app.delete("/urlshortener/:id", async function (request, response) {
    const data = request.body
    let { id } = request.params


    const urldelete = client.db("urlshortener").collection("userurls").updateOne({ username: id }, {
        $pull: {
            urls: { surl: data.surl }
        }
    })
    if (urldelete) {
        response.send({ message: "success" })

    } else {
        response.send({ message: "error" })
    }





})




app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨`));