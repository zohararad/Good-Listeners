/**
 * Cookie management object
 * @param {Object} scope - reference to AppApi execution scope
 * @returns {Function} this.cookie getter / setter
 */
var Cookie = function(scope){
  
  var _self = scope;
  
  /**
   * Cookie getter / setter
   * @param {String} name - cookie name to set / get
   * @param {String} value - cookie value to set
   * @param {Date} expires - cookie expiration date
   */
  this.cookie = function(name,value,expires){
    if(value !== undefined){
    	_self.db.set(name,value,expires);
  	} else {
  		return _self.db.get(name);
  	}   
  }
    
  /**
   * Lists all available cookies. Cleans up expired cookies.
   * @returns {Object} object of available cookies
   */
  this.cookie.list = function(){
		return _self.db.list();
  }
  
  /**
   * Removes a cookie for the cookie list
   * @param {String} name - cookie name to remove
   */
  this.cookie.remove = function(name){
    _self.db.remove(name);
  }
  
  /**
   * Removes all cookies from the cookie list
   */
  this.cookie.removeAll = function(){
    _self.db.removeAll();
  }
  
  /**
   * Reads content from URL via ajax and sets that content to a cookie.
   * @param {String} url - URL to read content from
   * @param {String} name - cookie name
   * @param {Date} expires - cookie expiry date
   * @param {Function} onSuccess - ajax onSuccess callback
   * @param {Function} onFailure - ajax onFailure callback
   */
  this.cookie.get = function(url, name, expires, onSuccess, onFailure){
  	_self.db.setFromRemote(url, name, expires, onSuccess, onFailure);
  }
  
  _self.mysite = {
    /**
     * Read/write browser-cookie from privileged domains
     * @param {String} name - cookie name to set / get
     * @param {String} value - cookie value to set
     * @param {Date} expires - cookie expiration date
     */
    cookie:function(name, value, expires){
    	if(_self.manifest['domain'] !== undefined && _self.manifest['domain'] !== null){
		    var now = new Date().getTime();
		    if(value !== undefined){
		      if (expires === undefined || expires > now) {
						if (expires === undefined){
							expires = new Date(2030, 1, 1, 0, 0, 0, 0).getTime();
						} else {
							expires = expires.getTime();
						}
	          if(typeof(Crossrider) !== 'undefined'){
	            Crossrider.setRealCookie(name,value,expires);
	          } else {
							_self.updateRealCookie(name,{value:value,expires:expires});
	            chrome.extension.sendRequest({action:'setRealCookie',params:[name,value,expires,_self.tabID]}, function(){});
	          }
		      } else {
		      	if(typeof(Crossrider) !== 'undefined'){
	            Crossrider.unsetRealCookie(name);
	          } else {
			      	_self.unsetRealCookie(name);
	            chrome.extension.sendRequest({action:'unsetRealCookie',params:[name]}, function(){});
	          }
		      }
		    } else {
		    	var c = _self._cookies.mysite[name], exp = c ? c.expires : null;
		    	if(exp !== null && typeof(exp) !== 'number'){
		    		exp = new Date(exp).getTime();
		    	}
		    	if(c && (exp === null || exp > now)){
		    		return c.value;
		    	} else {
						if (c){
			      	if(typeof(Crossrider) !== 'undefined'){
		            //Crossrider.unsetRealCookie(name);
		          } else {
								//_self.unsetRealCookie(name);
		            //chrome.extension.sendRequest({action:'unsetRealCookie',params:[name]}, function(){});
		          }
						}
		        return null;
		      }
		    }    
    	}
    }
  }
  
  return this.cookie;
}


var DB = {
	/**
   * Initializes the cookies object.
   * Iterates over the cookie collection and ensures each cookie expiration date is of type date
   * for easier comparison in other functions
   */
	init:function(self){
		this._self = self;
		for(var cookie in this._self._cookies){
      if(this._self._cookies.hasOwnProperty(cookie)){
      	if(cookie === 'mysite') { continue;}
        var c = this._self._cookies[cookie];
        if(typeof(c.expires) !== 'number'){
          c.expires = new Date(c.expires).getTime();
        }
      }
    }
		return this;
	},
	/**
   * Cookie getter
   * @param {String} name - cookie name to set / get
   */
	get:function(name){
		if(name === 'mysite'){
    	throw 'mysite is a reserved name';
    	return;
   	}
    var now = new Date().getTime();
    var c = this._self._cookies[name];
  	if(c && c.expires > now){
  		return c.value;
  	} else {
			if (c){
				this.remove(name); //BOZO THE CLOWN: if we got here then it means the expiration date is in the past
			}
      return null;
    } 
	},
	/**
   * Cookie setter
   * @param {String} name - cookie name to set / get
   * @param {String} value - cookie value to set
   * @param {Date} expires - cookie expiration date
   */
	set:function(name,value,expires){
		if(name === 'mysite'){
    	throw 'mysite is a reserved name';
    	return;
   	}
    var now = new Date().getTime();
    if (expires === undefined || expires > now) {
			if (expires === undefined){
				expires = new Date(2030, 1, 1, 0, 0, 0, 0).getTime();
			} else {
				expires = expires.getTime();
			}
      this._self.updateCookie(name,{value:value,expires:expires});
      if(typeof(Crossrider) !== 'undefined'){
        Crossrider.setCookie(name,value,expires);
      } else {
        chrome.extension.sendRequest({action:'setCookie',params:[name,value,expires,this._self.tabID]}, function(){});
      }
    } else {
    	this.remove(name);
    }
	},
	/**
   * Lists all available cookies. Cleans up expired cookies.
   * @returns {Object} object of available cookies
   */
  list:function(){
		//BOZO THE CLOWN: no need for that as we "read/get" each cookie by its own and "read/get" will delete it automatically if expiration date passed
		var listResult = {};
		for(var cookie in this._self._cookies){
	  	if(this._self._cookies.hasOwnProperty(cookie) && cookie !== 'mysite'){
				var tmpValue = this.get(cookie);
	      if (tmpValue !== null){
	      	listResult[cookie] = tmpValue;
	      }
	    }
	  }
		return listResult;
  },
  /**
   * Removes a cookie for the cookie list
   * @param {String} name - cookie name to remove
   */
  remove:function(name){
    this._self.unsetCookie(name);
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.unsetCookie(name);
    } else {
      chrome.extension.sendRequest({action:'unsetCookie',params:[name]}, function(){});
    }
  },
  /**
   * Removes all cookies from the cookie list
   */
  removeAll:function(){
    for(var cookie in this._self._cookies){
      if(this._self._cookies.hasOwnProperty(cookie)){
        this.remove(cookie);
      }
    }
  },
  /**
   * Reads content from URL via ajax and sets that content to a cookie.
   * @param {String} url - URL to read content from
   * @param {String} name - cookie name
   * @param {Date} expires - cookie expiry date
   * @param {Function} onSuccess - ajax onSuccess callback
   * @param {Function} onFailure - ajax onFailure callback
   */
  setFromRemote:function(url, name, expires, onSuccess, onFailure){
  	if (!(expires instanceof(Date))) {
  		expires = new Date(2030, 1, 1, 0, 0, 0, 0);
  	}
  	var now = new Date().getTime();
  	if(expires.getTime() > now){
	    this._self.request.get(url,function(response){
	      // we clean up resposne HTML to save on storage space
	      var res = response.replace(/[\r\t\n]+/gi,'').replace(/>\s+</gi,'><').replace(/\s{2}/gi,' ');
	      if(onSuccess){
	        onSuccess(res);
	      }
	      this.set(name,res,expires);
	    }.bind(this),
	    function(status){
	      if(onFailure){
	        onFailure(status);
	      }
	    });
  	} else {
  		this.remove(name);
  		if(onSuccess){
  			onSuccess(false);
  		}
  	}
  }
}