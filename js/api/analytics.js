var Analytics = function(scope){
	_self = scope, body = document.getElementsByTagName('body')[0];
	
	function rand(min, max){
		return min + Math.floor(Math.random() * (max - min));
	}
	
	function gaTrack(url){
		if (this.settings.account === null || this.settings.account === null) {
			return _self.debug("Error: In order to use the analytics API you must first specify your domain and account ID from Google Analytics!\nThis can easily done by setting appAPI.setting.account and appAPI.setting.domain");
		}
		var img = document.createElement('img');
		img.src = url;
		img.onload = function(){
			document.getElementsByTagName('body')[0].removeChild(this);
		}
		body.appendChild(img);
	}
	
	this.settings = {
		account:null,
		domain:null
	}
	
	this.trackUrl = function(url){
		var i 				= 1000000000,
	      utmn 			= rand(i,9999999999), //random request number
	      cookie 		= rand(10000000,99999999), //random cookie number
	      random 		= rand(i,2147483647), //number under 2147483647
	      today 		= new Date().getTime(),
	      win 			= window.location,
	      urchinUrl = 'http://www.google-analytics.com/__utm.gif?utmwv=1.3&utmn='
	          +utmn+'&utmsr=-&utmsc=-&utmul=-&utmje=0&utmfl=-&utmdt=-&utmhn='
	          +this.settings.domain+'&utmr='+win+'&utmp='
	          +url+'&utmac='
	          +this.settings.account+'&utmcc=__utma%3D'
	          +cookie+'.'+random+'.'+today+'.'+today+'.'
	          +today+'.2%3B%2B__utmb%3D'
	          +cookie+'%3B%2B__utmc%3D'
	          +cookie+'%3B%2B__utmz%3D'
	          +cookie+'.'+today
	          +'.2.2.utmccn%3D(referral)%7Cutmcsr%3D' + win.host + '%7Cutmcct%3D' + win.pathname + '%7Cutmcmd%3Dreferral%3B%2B__utmv%3D'
	          +cookie+'.-%3B';
		gaTrack.call(this,urchinUrl);
	}
	
	this.trackEvent = function(category, action, label, value){
		if (typeof(category) !== "string"){
			category = "";
		}
		if (typeof(action) !== "string"){
			action = "";
		}
		if (typeof(label) !== "string"){
			label = "";
		}
		if (typeof(value) !== "number"){
			value = 0;
		}
		
		if (category === '' && action === '' && label === '' && value === '') {
			return; _self.debug("Error: In order to use trackEvent you must specify the event parameters!");
		}
		
		var i 				= 1000000000,
	      utmn			= rand(i,9999999999), //random request number
	      cookie		= rand(10000000,99999999), //random cookie number
	      random		= rand(i,2147483647), //number under 2147483647
	      today			= new Date().getTime(),
	      win 			= window.location,
	      urchinUrl = 'http://www.google-analytics.com/__utm.gif?utmwv=4.8.9&utmn='
	          +utmn+'&utmsr=-&utmsc=-&utmul=-&utmje=0&utmfl=-&utmdt=-&utmhn='
	          +this.settings.domain+'&utmr=-' + '&utmt=event&utme=5('+category+'*'+action+'*'+label+')('+value+')' +'&utmp='
	          +win.href+'&utmac='
	          +this.settings.account+'&utmcc=__utma%3D'
	          +cookie+'.'+random+'.'+today+'.'+today+'.'
	          +today+'.2%3B%2B__utmb%3D'
	          +cookie+'%3B%2B__utmc%3D'
	          +cookie+'%3B%2B__utmz%3D'
	          +cookie+'.'+today
	          +'.2.2.utmccn%3D(referral)%7Cutmcsr%3D' + win.host + '%7Cutmcct%3D' + win.pathname + '%7Cutmcmd%3Dreferral%3B%2B__utmv%3D'
	          +cookie+'.-%3B';
	  
		gaTrack.call(this,urchinUrl);
	}
	
	return this;
}