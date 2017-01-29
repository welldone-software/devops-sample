const express = require('express')
const multer = require('multer')
const {Pool} = require('pg')
const fs = require('fs')
const path = require('path')
const md5 = require('md5')

const baseFilePath = process.env.BASE_FILE_PATH || '/var/app-files'
const port = process.env.PORT || 3000

const db = new Pool({
    host: process.env.DB_HOST || 'postgres',
    database: 'postgres',
    user: 'postgres',
    password: 'mysecretpassword',
    nax: 10,
    idleTimeoutMillis: 1000
});

if(!fs.existsSync(baseFilePath)){
    fs.mkdirSync(baseFilePath);
}

const app = express()

app.get('/ping/:what', (req, res) => {
    res.send(`pong ${req.params.what}`)
})

app.get('/write/:key/:value', ({params:{key, value}}, res, next) => {
    const file = path.join(baseFilePath, md5(key))
    const content = `${key}${'\n'}${value}\n`
    fs.writeFile(file, content, err => err ?  next(err) : res.send(`saved '${value}' as '${key}' to file`))
})

app.get('/read/:key', ({params:{key}}, res, next) => {
    const file = path.join(baseFilePath, md5(key))
    fs.readFile(file, {encoding: 'utf-8'}, (err, data) => err ? next(err) : res.send(`file value of ${key} is ${data.split('\n')[1]}` ))
})

app.get('/db-write/:key/:value', ({params:{key, value}}, res, next) => {
    db.query('INSERT INTO values (key, value) VALUES($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value])
        .then(() => res.send(`saved '${value}' as '${key}' to db`))
        .catch(next)
    
})

app.get('/db-read/:key', ({params:{key}}, res, next) => {
    db.query('SELECT value FROM values WHERE key = $1', [key])
        .then(({rows}) => res.send(`db value of ${key} is ${rows[0].value}`))
        .catch(next)
    
})

app.get('*', (req, res) => {
    const urls = ['/ping/:what', '/write/:key/:value', '/read/:key', '/db-write/:key/:value', '/db-read/:key']
    res.send(`
        <h3>Available urls: </h3>
        <ul>
            ${urls.map(u => `<li><pre>${u}</pre></li>`).join('')}
        </ul>
    `)
})

db.query('CREATE TABLE IF NOT EXISTS values (key varchar(100) NOT NULL PRIMARY KEY, value varchar(1000))')
    .then(() => app.listen(port, () => console.log(`db ready and server listens on port ${port}`)))
    .catch(err => console.log(err))
