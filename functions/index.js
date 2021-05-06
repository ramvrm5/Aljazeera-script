const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid')
var serviceAccount = require("./permissions.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://autofeed2020.firebaseio.com"
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true })

const axios = require('axios');
const request = require('request');
const cheerio = require("cheerio");
const fs = require("fs");
const json2csv = require("json2csv").Parser;
const htmlToText = require('html-to-text');
const dateFinder = require('datefinder')
const moment = require('moment');

const express = require('express');
const cors = require('cors');
const { endianness } = require('os');
const { url } = require('inspector');
const { urlencoded } = require('body-parser');
const app = express();

app.use(cors({ origin: true }));

let fecha = parseInt(moment(new Date()).format("x") / 1000);
let fechaClasica = new Date().toISOString()
let News_found = "NO"
let Arraydata = [{
    titulo: "",
    descripcion: "",
    cuerpo: "",
    img: "",
    url: "",
    fecha: fecha,
    fechaClasica: fechaClasica,
    fuente: '',
    tags: '',
    idioma: '',
}];
let tags = []

async function getAlltags() {
    try {
        let query = await db.collection('usuarios');
        await query.get()
            .then(async function (querySnapshot) {
                let docs = querySnapshot.docs;
                for (let doc of docs) {
                    if (doc.data().tags) {
                        for (let tag of doc.data().tags) {
                            if(tag){
                                let tempTags = tag.split(";")
                                for (let i = 0; tempTags.length > i; i++) {
                                    tags.push(tempTags[i]);
                                }
                            }
                        }
                    }
                }
                //console.log(tags)
                aljazeera()
            });
    } catch (error) {
        console.log(error);
    }
}

async function aljazeera() {
    console.log("tag length :" + tags.length)
    for (let j = 0; tags.length > 0;) {
        if (tags[j] !== "Comment gagner un million d'euros" && tags[j]) { 
            console.log("tag :" + tags[j])
            let aljazeera_tag = tags[j].replace(/'/g, '');
            aljazeera_tag = encodeURI(tags[j]);
            let url_aljazeera = 'https://www.aljazeera.com/search/' + aljazeera_tag 
            await axios({
                method: 'get',
                url: url_aljazeera,
            }).then(async function (response) {
                const batch = db.batch();
                getData(response ? response.data : "", "aljazeera", aljazeera_tag);//aljazeera_tag   
                await Arraydata.forEach(function (object, i, array) {
                    let tempdate = object.date && object.date.length > 0 ? object.date[0].date : new Date();
                    let fechaTemp = parseInt(moment(tempdate).format("x") / 1000);
                    let fechaClasicaTemp = new Date(tempdate).toISOString();
                    let arraytags = [aljazeera_tag];
                    let description = object.date && object.date.length > 0 ? object.description.replace(object.description.substring(object.date[0].startIndex, object.date[0].endIndex), ""):object.description;
                    description = description?description.replace("...",' ').trim():description;
                    description = description?description.replace("result",' ').trim():description;
                    //console.log("description--------------------> "+ description)
                    if (object.description && object.description.length > 0 && object.url && object.url.length > 0) {
                        let aljazeera = db.collection("my_collection").doc().id + "_seekingApha";
                        let unique_url_aljazeera = encodeURIComponent(object.url);
                        const Ref = db.collection('noticias2').doc(unique_url_aljazeera)
                        console.log("enter firebase forEach")
                        batch.set(Ref, {
                            id: uuidv4(),
                            titulo: object.title,
                            descripcion: description,
                            cuerpo: description,
                            img: object?object.img:'https://firebasestorage.googleapis.com/v0/b/autofeed2020.appspot.com/o/img%2Fwhitelogo.png?alt=media&token=e9002688-358a-4997-94b0-31b460635c01',//object.img,
                            url: object.url,
                            fecha: fechaTemp,
                            fechaClasica: fechaClasicaTemp,
                            fuente: 'aljazeera',
                            tags: arraytags,
                            idioma: 'es',
                        })
                    }
                    if (Arraydata.length == i + 1) {
                        j++
                    }
                })
                batch.commit().then(async function () {
                    await console.log('Done.')
                }).catch(err => console.log(`There was an error: ${err}`))
            }).catch(error => {
                console.log(error);
            })
        } else {
            if (tags.length == j) {
                console.log("tags.length  " + j)
                console.log("break  " + j)
                break
            } else {
                console.log("undefined  " + j)
                j++
            }
        } 
    }
}

async function getData(html, type, tags) {
    Arraydata = [{
        titulo: "",
        descripcion: "",
        cuerpo: "",
        img: "",
        url: "",
        fecha: fecha,
        fechaClasica: fechaClasica,
        fuente: '',
        tags: '',
        idioma: '',
    }];
    if (type == "aljazeera") {
        if (html) {
            const $ = cheerio.load(html);
            $('div.l-col.l-col--8 div.l-col.l-col--8  article.gc').each(async function () {
                title = $(this).find('.gc__title a').text();
                description = $(this).find('.gc__excerpt p').text();
                rawdateFinder = dateFinder(description);
                //descriptionFullText = $(this).find('.gc__excerpt p').text().split("...");
                //description = descriptionFullText[1];
                img = $(this).find('.responsive-image img').attr("src");
                url_news = $(this).find('.gc__title a').attr("href");
                tag = tags;
                //date = descriptionFullText.length == 2 && descriptionFullText[1].length > 5?descriptionFullText[0].trim():"";
                //date1 = date2.replace(/,/g, ""),
                //date = date1.replace(/\s/g, '-'),
                await Arraydata.push({
                    title: title,
                    description: description,
                    img: img,
                    url: url_news,
                    tag: tag,
                    date: rawdateFinder,
                    language: "en"
                });
            });
        }
    }
    News_found = Arraydata.length > 1 ? "Yes" : "No";
    Arraydata.length > 1 ? Arraydata.shift() : Arraydata;
}


//aljazeera()
getAlltags();

exports.app = functions.https.onRequest(app);