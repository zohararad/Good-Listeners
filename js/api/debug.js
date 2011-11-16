var Debugger = function(scope){
	var _self = scope;
	var _debugMode = typeof(Crossrider) === 'undefined' ? _self.isDebugMode() : Crossrider.debug;
	
	this.debug = function(msg,alertIt){
		if(!_debugMode){
			return;
		}
		var showAlert = alertIt || !this.debug.settings.console;
		if(showAlert){
			alert(msg);
		} else {
			if(this.debug.settings.timestamp){
				var d = new Date();
				var s = d.toLocaleTimeString() + "." + d.getMilliseconds()+":";
				console.log(d,msg);
			} else {
				console.log(msg)
			}
		}
	}
	
	this.debug.settings = {
		console: true,
		timestamp: true
	}
	
	return this.debug;
}
