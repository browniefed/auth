var request = require('request');
var restify = require('restify');
var uuid = require('node-uuid');
var _ = require('lodash');
var authenticateUser = require('./authUser');

var restify = require('restify'),
    request = require('request'),
    qs = require('querystring');

var JamaPassthrough = function(options) {
	this.setRestEndpoint(options.restEndpoint);
	this.setAllowedCORS(options.allowedCORS || ['*']);
    this.setPort(options.port || 9999);
    this.appCookieJars = {};
}

JamaPassthrough.prototype.setRestEndpoint = function(restEndpoint) {
	this.restEndpoint = restEndpoint;
}

JamaPassthrough.prototype.getRestEndpoint = function() {
	return this.restEndpoint;
}

JamaPassthrough.prototype.setPort = function(port) {
    this.port = port;
}

JamaPassthrough.prototype.getPort = function() {
    return this.port;
}


JamaPassthrough.prototype.setAllowedCORS = function(allowedCORS) {
	this.allowedCORS = allowedCORS;
}
JamaPassthrough.prototype.getAllowedCORS = function(allowedCORS) {
    return this.allowedCORS;
}
JamaPassthrough.prototype.setupServer = function() {

	this.server = restify.createServer();

    this.server.use(restify.CORS({
        origins: this.getAllowedCORS()
    }));
    this.server.use(restify.authorizationParser());
    this.server.use(restify.bodyParser());
    this.server.use(restify.queryParser());

	//This defaults to accepting ALL connections.
	//In production this should definitely be limited to your production environment
	this.server.post('/auth', function(req, res) {
		var guid = uuid.v4();

        var appName = req.headers['x-auth-app'];
        if (!appName) {
            res.send(404, 'Please provide an application name in the headers as x-auth-app');
            return;
        }

        if ( !req.params.username || !req.params.password) {
            res.send(404, 'Please provide a username and password');
            return;
        }

		authenticateUser({
			username: req.params.username,
			password: req.params.password
		}, function(err, jar) {
            if (err) {
                res.send(404, 'Username or password are incorrect')
                return;
            }
			this.appCookieJars[appName + '_' + req.params.username] = {
				jar: jar,
				token: guid
			};

			res.send({
                token: guid
            });
		}.bind(this));

	}.bind(this));

    this.server.get(/ui\/internal\/(.*)/,this.respond.bind(this, ''));
    this.server.put(/ui\/internal\/(.*)/,this.respond.bind(this, ''));
    this.server.post(/ui\/internal\/(.*)/,this.respond.bind(this, ''));
    this.server.del(/ui\/internal\/(.*)/,this.respond.bind(this, ''));

	this.server.get(/(.*)/, this.respond.bind(this, 'rest/latest'));
	this.server.put(/(.*)/, this.respond.bind(this, 'rest/latest'));
	this.server.post(/(.*)/, this.respond.bind(this, 'rest/latest'));
	this.server.del(/(.*)/, this.respond.bind(this, 'rest/latest'));

	
	this.server.listen(this.getPort(), function() {
		console.log('started');
	});

    this.server.on('MethodNotAllowed', unknownMethodHandler);

}

JamaPassthrough.prototype.respond = function(restEndpoint, req, res, next) {
    var method = (req.method || 'get').toUpperCase();

    var body = req.body;
    if (method == 'GET') {
        body = qs.parse(req.body || '')
    }
    var jar = _.find(this.appCookieJars, function(cookieJar) {
    	return cookieJar.token == req.headers['x-auth-token'];
    });

    if (!jar) {
    	res.send(404);
    }

    request({
        url: this.getRestEndpoint() + restEndpoint + req.url,
        body: body,
        method: method,
        json: true,
        jar: jar.jar
    }, function(jamaErr, jamaRes, jamaBody) {
        res.send(jamaRes.statusCode, jamaBody);
    })
}

JamaPassthrough.prototype.start = function() {
	if (!this.getRestEndpoint()){
		console.warn("Warning: No rest endpoint has been set");
	}
	this.setupServer();
}

/*
    Make it so restify handles preflight OPTION requests.
    Just accept eveything initially we can limit ourselves via restify.CORS()
*/
function unknownMethodHandler(req, res) {
  if (req.method.toLowerCase() === 'options') {
    var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'Origin', 'X-Requested-With', 'Authorization', 'X-Auth-App', 'X-Auth-Token']; // added Origin & X-Requested-With & **Authorization**

    if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');

    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
    res.header('Access-Control-Allow-Methods', res.methods.join(', '));
    res.header('Access-Control-Allow-Origin', req.headers.origin);

    return res.send(200);
  }
  else
    return res.send(new restify.MethodNotAllowedError());
}


var restEndpoint = 'https://www.jamaland.com/';
var optionalCORS = ['*']; 
var port = process.env.PORT || 9999;

var JamaAPI = new JamaPassthrough({
    restEndpoint: restEndpoint,
    allowedCORS: optionalCORS,
    port: port
});
JamaAPI.start();
console.log('Your REST API is at ' + restEndpoint);
console.log('listening for requests on port ' + port);
