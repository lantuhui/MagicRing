const fs = require('fs');
const promisify = require('es6-promisify');
const stat = promisify(fs.stat);
const path = require('path');
const pug = require('pug');
const readdir = promisify(fs.readdir);
const mime = require('./mime');
const compress = require('./compress');
const range = require('./range');
const isFresh = require('./cache');

const tplPath = path.join(__dirname, '../template/dir.pug');
// const source = fs.readFileSync(tplPath);
// const template = pug.compile(source);
const template = pug.compileFile(tplPath);

module.exports = async (req, res, filePath, config) => {
    try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
            const contentType = mime(filePath);
            res.setHeader('Content-Type',contentType + ';charset=UTF-8');
            if(isFresh(stats,req,res)) {
                res.statusCode = 304;
                res.end();
                return;
            }
            let rs;
            const {code, start, end} = range(stats.size,req,res);
            if(code === 200) {
                res.statusCode = 200;
                rs = fs.createReadStream(filePath);
            } else {
                res.statusCode = 206;
                rs = fs.createReadStream(filePath, {start,end});
            }
            if(filePath.match(config.compress)) {
                rs = compress(rs,req,res);
            }
            rs.pipe(res);
            // res.write('huangxi');
            // res.end('lantu');
        } else if (stats.isDirectory()) {
            const files = await readdir(filePath);
            res.statusCode = 200;
            res.setHeader('Content-Type','text/html;charset=UTF-8');
            const data = {
                title: path.basename(filePath),
                dir: req.url === '/' ? '' : req.url,
                files: files.map(file => ({
                    name: file,
                    icon: mime(file)
                }))
            };
            res.end(template(data));
        }
    } catch (ex) {
        console.info('err happened')
        console.error(ex);
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`${filePath} is not a directory or file \n ${ex.toString()}`);
    }
};