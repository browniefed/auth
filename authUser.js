var request = require('request');
var cheerio = require('cheerio');
var _ = require('lodash');

function authenticateUser(user, returnCb) {
	var j = request.jar();
	request({
		url: 'https://jamasoftware.okta.com/login/do-login',
		jar: j,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }
	}, function(err, res, body) {
            var $ = cheerio.load(body);
            var actionUrl = $('form').attr('action');
            var formValues = {};
            var inputs = $('form input').each(function() {
                if ($(this).attr('name')) {
                    formValues[$(this).attr('name')] = $(this).attr('value') || '';
                }
            });


            formValues = _.extend(formValues,{
                    username: user.username,
                    password: user.password,
                });
            request.post({
                url: 'https://jamasoftware.okta.com' + actionUrl,
                form: formValues,
                followAllRedirects: true,
                jar: j,
                headers: {
                    'Host': 'jamasoftware.okta.com',
                    'Origin': 'https://jamasoftware.okta.com',
                    'Upgrade-Insecure-Requests': '1',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://jamasoftware.okta.com/login/do-login',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
                }
            }, function(err, res, body) {
                request.get({
                    url: 'https://www.jamaland.com/perspective.req#/home',
                    followAllRedirects: true,
                    jar: j
                }, function(err, res, body) {
                    processBody(body, j, function(err) {
                        returnCb(err, j)
                    })
                })
            })
	})
}


function processBody(body, j, cb) {
    var $ = cheerio.load(body);

    var formUrl = $('form').attr('action');
    var samltoken = $('form input').eq(0).attr('SAMLRequest');

    request.post({
        url: formUrl,
        followAllRedirects: true,
        form:{
            SAMLRequest: samltoken
        },
        jar: j, 
        headers: {                    
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }
    }, function(err, res, loginBody) {
        processResponse(loginBody, j, function() {
           request.get({
                url: 'https://www.jamaland.com/rest/latest/users/current',
                followAllRedirects: true,
                jar: j,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
                }
            }, function(err, res, body) {
                cb(err, body);
            }) 
        })

    })

}

function processResponse(body, j, cb) {
var $ = cheerio.load(body);

    var formUrl = $('form').attr('action');
    var samltoken = $('form input').eq(0).attr('value');
    request.post({
        url: formUrl,
        followAllRedirects: true,
        form: {
            SAMLResponse: samltoken
        },
        jar: j,
        headers: {                    
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }
    }, function(err, res, responseBody) {
        cb();
    })

}

module.exports = authenticateUser;