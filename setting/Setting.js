define([
    'dojo/_base/declare',
    'jimu/BaseWidgetSetting',
	'dijit/form/TextBox'
  ],
  function(declare, BaseWidgetSetting, TextBox) {
    return declare([BaseWidgetSetting], {
      baseClass: 'jimu-widget-mapState-setting',

	  projectPreUrlInput: null, 
	  printTaskUrlInput: null, 
	  portalHandlerUrlInput: null, 

      postCreate: function() {
        this.inherited(arguments);
		
		this.projectPreUrlInput = new TextBox({
			style: 'width: 800px;'
		}, this.projectPreUrlInputNode);
		this.printTaskUrlInput = new TextBox({
			style: 'width: 800px;'
		}, this.printTaskUrlInputNode);
		this.portalHandlerUrlInput = new TextBox({
			style: 'width: 800px;'
		}, this.portalHandlerUrlInputNode);

		this.projectPreUrlInput.startup(); 
		this.printTaskUrlInput.startup(); 
		this.portalHandlerUrlInput.startup();
      },

      startup: function() {
        this.inherited(arguments);
		this.setConfig(this.config);
      },

      setConfig: function(config) {
        this.config = config;

		this.projectPreUrlInput.setValue(config.gpServiceUrl); 
		this.printTaskUrlInput.setValue(config.exportWebMapUrl); 
		this.portalHandlerUrlInput.setValue(config.gpServiceUrlPortal); 
      },

      getConfig: function() {
		var config = {};
		config["gpServiceUrl"] = this.projectPreUrlInput.getValue(); 
		config["exportWebMapUrl"] = this.printTaskUrlInput.getValue(); 
		config["gpServiceUrlPortal"] = this.portalHandlerUrlInput.getValue(); 
		
        return config;
      }
	  
    });
  });