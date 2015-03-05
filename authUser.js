var request = require('request');
var formRegex = /action=\"([\s\S]*?)\"/gm;

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

module.exports = authenticateUser;