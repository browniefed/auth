var request = require('request');
var restify = require('restify');
var server = restify.createServer();
var Guid = require('guid');

var formRegex = /action=\"([\s\S]*?)\"/gm;

var users = {};


function authenticateUser(user, cb) {
	var j = request.jar();

	request({
		url: 'https://www.jamaland.com',
		jar: j
	}, function(err, res, body) {
		var url = formRegex.exec(body)[1];

		request.post({
			url: 'https://adfs.jamasoftware.com' + url,
			form: {
				UserName: user.username,
				Password: user.password,
				AuthMethod:'FormsAuthentication'
			},
			followAllRedirects: true,
			gzip: true,
			jar: j
		}, function(err, res, body) {
			cb(j);
		})
	})
}

server.post('/auth', function(req, res) {
	var guid = Guid.create();

	authenticateUser({
		username: req.params.username,
		password: req.params.password
	}, function(jar) {
		users[guid] = jar;
		res.send(guid);
	});


});

server.use(restify.bodyParser());
server.use(restify.CORS());

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});