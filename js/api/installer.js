var Installer = function(scope){
	var _self = scope, _this = this;
	
	this.getParams = function(){
		var params = _self._cookies["InstallerParams"];
		if(typeof(params) !== "undefined") {
			return params.value;
		}
		
		return {};
	};
	
	this.getUnixTime = function(){
		var time = _self._cookies["InstallationTime"];
		if(typeof(time) !== "undefined") {
			return parseInt(time.value);
		}
		
		return 0;
	}
	
	return this;
};