var Push = function(scope){
  var _self = scope;
  this._connected = false;
  /**
   * Creates a Faye client and connects to Crossrider messaging server
   */
  this.connect = function(callback){
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.connect();
    } else {
      chrome.extension.sendRequest({action:'connect',passCallback:true}, function(){
      	this._connected = true;
      	if(typeof(callback) === 'function'){
      		callback.call(this);
      	}
      }.bind(this));
    }
  }
  
  /**
   * Publishes a message to the Crossrider Faye server using a Faye client
   * @param {String} channel - the channel to connect to
   * @param {String} data - the data to pass in the message
   */
  this.publish = function(channel,data){
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.publish(channel,data);
    } else {
      chrome.extension.sendRequest({action:'publish',params:[channel,data]}, function(){});
    }
  }
  
  /**
   * Subscribes to a Faye messaging channel
   * @param {String} channel - channel to subscribe to
   * @param {Function} callback - callback to execute when a message arrives to the channel
   * @param {Boolean} async - if set to true, call is made on behalf of async API rather than appAPI
   */
  this.subscribe = function(channel,callback,async){
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.subscribe(channel,callback);
    } else {
    	var key = async ? 'asyncCallbacks' : 'callbacks';
    	if(_self._faye[key][channel]){
    		delete _self._faye[key][channel];
    	}
    	var f = function(){
	      chrome.extension.sendRequest({action:'subscribe',params:[channel,null,_self.tabID,async]},function(){
	      	_self._faye[key][channel] = callback;
	      }.bind(this));
    	}.bind(this);
    	
    	if(!this._connected){
    		this.connect(f);
    	} else {
    		f();
    	}
    }
  }
  
  /**
   * Unsubscribes from a Faye messaging channel
   * @param {String} channel - channel to subscribe to
   * @param {Function} callback - callback to execute when a message arrives to the channel
   * @param {Boolean} async - if set to true, call is made on behalf of async API rather than appAPI
   */
  this.unsubscribe = function(channel,async){
  	if(typeof(Crossrider) !== 'undefined'){
      Crossrider.unsubscribe(channel,'background');
    } else {
    	if(_self._faye[async ? 'asyncCallbacks' : 'callbacks'][channel]){
		    delete _self._faye[async ? 'asyncCallbacks' : 'callbacks'][channel];
	      chrome.extension.sendRequest({action:'unsubscribe',params:[channel,_self.tabID,async]},function(){});
    	}
    }
  }
  
  return this;
}
