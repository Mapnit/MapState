define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/_base/html',
    'dojo/on',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'jimu/utils',
    'dijit/form/Select',
	'dijit/form/TextBox'
  ],
  function(declare, lang, array, html, on, _WidgetsInTemplateMixin, 
    BaseWidgetSetting, jimuUtils, Select, TextBox) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-mapState-setting',
	  _storeStrategyOptions: null, 
	  
	  storeStrategySelect: null, 
	  storeServiceUrlInput: null, 
	  
      _disabledClass: "jimu-state-disabled",
	  
	  postMixInProperties:function(){
        this.inherited(arguments);
		
		this._storeStrategyOptions = [
		  {value: "local", label: this.nls.localStore},
		  {value: "remote", label: this.nls.remoteStore}
	    ];
	  }, 

      postCreate: function() {
        this.inherited(arguments);
		
		this.storeStrategySelect = new Select({
		}, this.storeStrategySelectNode);
		this.storeStrategySelect.startup(); 
		
		array.forEach(this._storeStrategyOptions, lang.hitch(this, function(opt) {
		  this.storeStrategySelect.addOption({
            value:opt.value,
            label:opt.label
          });
		})); 
		
		this.own(on(this.storeStrategySelect, 'change', lang.hitch(this, this._resetStoreStrategySelect)));
		
		this.storeServiceUrlInput = new TextBox({
		}, this.storeServiceUrlInputNode);
		this.storeServiceUrlInput.startup(); 
		
      },

      startup: function() {
        this.inherited(arguments);
		this.setConfig(this.config);
      },

      setConfig: function(config) {
        this.config = config;
		
		this.storeStrategySelect.setValue(config.storeStrategy); 
		this.storeServiceUrlInput.setValue(config.storeServiceUrl); 
		
		this._resetStoreStrategySelect(config.storeStrategy); 
      },

      getConfig: function() {
        var config = {
          storeStrategy: this.storeStrategySelect.value
        };
		if (config.storeStrategy === "remote") {
			config["storeServiceUrl"] = this.storeServiceUrlInput.getValue(); 
		}
        return config;
      },
	  
	  _resetStoreStrategySelect: function(selectedValue) {
		if (selectedValue == "local") {
			this.storeServiceUrlInput.attr('disabled', true); 
			html.addClass(this.storeServiceUrlInputNode, this._disabledClass);
		} else {
			this.storeServiceUrlInput.attr('disabled', false); 
			html.removeClass(this.storeServiceUrlInputNode, this._disabledClass);
		}
	  }
	  
    });
  });