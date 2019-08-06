var Main = function(){

    var me = {};

    me.init = function(){
        Template.load(Config.templateURL+'?v' + version, function(templates) {

			if (Config.usePass){
				var hasPass = readCookie("pass" + Config.apiScope);
				if (hasPass){
					me.initApp();
				}else{
					UI.showLogin();
				}
			}else{
				me.initApp();
            }


			if (Config.useMapBoxInspector){

				var head = document.getElementsByTagName("head")[0];

				var script = document.createElement("script");
				script.addEventListener ("load", loadTemplates, false);
				script.src = "_script/lib/mapbox-gl-inspect.min.js";
				head.appendChild(script);

				var link = document.createElement("link");
				link.rel = "stylesheet";
				link.type = "text/css";
				link.href = "_style/mapbox-gl-inspect.css";
				head.appendChild(link);

			}

        });
    };

    me.initApp = function(){
		if (Config.showDisclaimerOnFirstUse) UI.showDisclaimer(true);

		if (Config.preLoad){
			UI.showLoader();
			Config.preLoad();
		}else{
			EventBus.trigger(EVENT.preloadDone);
		}
    };

    document.addEventListener('DOMContentLoaded', function() {
        me.init();
    });

	window.addEventListener('resize', function() {
		EventBus.trigger(EVENT.UIResize);
	});

	EventBus.on(EVENT.preloadDone,function(){
		MapService.init();
		UI.init();
		SearchService.init();
    });

    return me;


}();