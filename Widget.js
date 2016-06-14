
define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/_base/html',
  'dojo/json',
  'jimu/BaseWidget',
  'jimu/portalUtils',
  'dojo/on',
  'dojo/aspect',
  'dojo/string',
  'esri/SpatialReference',
  'esri/geometry/Extent',
  'esri/graphic',
  'esri/layers/GraphicsLayer',
  './MapStateManager',
  'jimu/LayerInfos/LayerInfos',
  'jimu/utils',
  'dojo/request/xhr',
  'libs/storejs/store'
],
function (declare, lang, array, html, json, BaseWidget, portalUtils, on, aspect, string,
  SpatialReference, Extent, Graphic, GraphicsLayer, MapStateManager, LayerInfos,
  utils, xhr, store) {
    return declare([BaseWidget], {
        //these two properties is defined in the BaseWidget
        baseClass: 'jimu-widget-mapstate',
        name: 'Mapstate',

        //mapStates: Object[]
        //    all of the map states, the format is the same as the config.json
        mapstates: [],

        //currentIndex: int
        //    the current selected mapstate index
        currentIndex: -1,

        //use this flag to control delete button
        _canDelete: false,

        //use this flag to control load button
        _canLoad: false,

        constructor: function (options) {
            this.map = options.map;
            if (this.map.itemInfo && this.map.itemInfo.item) {
                this.mapName = options.map.itemInfo.item.title;
            } else {
                this.mapName = "this webmap";
            }
            this.storeStrategy = options.config.storeStrategy;
            this.storeServiceUrl = options.config.storeServiceUrl;
            this.layerInfosObj = null;
            /* get the username */
            this.portal = portalUtils.getPortal(options.appConfig.portalUrl);
            this.userName = this.portal.user.username;
            /*username and webmap id to serve as a store key*/
            this.storeKey = this.userName + "_" + this.map.itemId;
            /* pre-set the map state name */
            this.mapstateName = { value: "mapstate" };
            this.MapStateManager = MapStateManager.getInstance(this.storeKey);
        },

        _addMapstate: function (stateData) {
            LayerInfos.getInstance(this.map, this.map.itemInfo)
                .then(lang.hitch(this, function (layerInfosObj) {
                    this.layerInfosObj = layerInfosObj;
                    if (stateData.extent || stateData.layers) {
                        this.mapstates = [];
                        this.mapstates.push(stateData);
                        this.currentIndex = 0;

                        if (this.mapstates.length === 0) {
                            this._readMapstatesInWebmap();
                        }
                        this.displayMapstates();
                    } else {
                        var msgText = utils.stripHTML(this.nls.errorNameEmpty);
                        msgText = msgText.replace("%mapName%", this.mapName);
                        this.mapstateMsgNode.innerHTML = msgText;

                        this.currentIndex = -1;
                    }

                    this._switchDeleteBtn();
                    this._switchLoadBtn();
                }));
        },

        onOpen: function () {
            if (this.storeStrategy === "remote") {
                xhr(this._composeStoreURL("query"), {
                    handleAs: "json"
                }).then(lang.hitch(this, function (stateDataText) {
                    var data = {};
                    if (stateDataText) {
                        var stateData = json.parse(stateDataText, true);
                        // transform the state data 
                        data = this.MapStateManager._prepareMapState(stateData);
                        //
                    }
                    this._addMapstate(data);
                }), lang.hitch(this, function (err) {
                    var msgText = utils.stripHTML(this.nls.errLoadFailure);
                    msgText = msgText.replace("%mapName%", this.mapName);
                    this.mapstateMsgNode.innerHTML = msgText;
                }));
            } else {
                // by default, use local storage
                this.MapStateManager.getMapState().then(lang.hitch(this, function (stateData) {
                    this._addMapstate(stateData);
                }));
            }
        },

        onClose: function () {
            this.mapstates = [];
            this.currentIndex = -1;
        },

        onMinimize: function () {
            this.resize();
        },

        onMaximize: function () {
            this.resize();
        },

        displayMapstates: function () {
            // display the map status status 
            if (this.mapstates && this.mapstates.length > 0) {
                // take the 1st one (assume only one be saved)
                var mapstate = this.mapstates[0];
                var msgText = utils.stripHTML(this.nls.msgStateStatus);
                msgText = msgText.replace("%date%", mapstate.updateDate);
                this.mapstateMsgNode.innerHTML = msgText;
            } else {
                var msgText = utils.stripHTML(this.nls.errorNameEmpty);
                msgText = msgText.replace("%mapName%", this.mapName);
                this.mapstateMsgNode.innerHTML = msgText;
            }
            // 
            //this._switchDeleteBtn();
            this.resize();
        },

        _readMapstatesInWebmap: function () {
            if (!this.map.itemInfo || !this.map.itemInfo.itemData ||
              !this.map.itemInfo.itemData.mapstates) {
                return;
            }
            array.forEach(this.map.itemInfo.itemData.mapstates, function (mapstate) {
                mapstate.isInWebmap = true;
                this.mapstates.push(mapstate);
            }, this);
        },

        _switchLoadBtn: function () {
            if (this.currentIndex > -1) {
                html.removeClass(this.btnLoad, 'jimu-state-disabled');
                this._canLoad = true;
            } else {
                html.addClass(this.btnLoad, 'jimu-state-disabled');
                this._canLoad = false;
            }
        },

        _switchDeleteBtn: function () {
            if (this.currentIndex > -1) {
                html.removeClass(this.btnDelete, 'jimu-state-disabled');
                this._canDelete = true;
            } else {
                html.addClass(this.btnDelete, 'jimu-state-disabled');
                this._canDelete = false;
            }
        },

        _onSaveBtnClicked: function () {
            if (string.trim(this.mapstateName.value).length === 0) {
                html.setStyle(this.errorNode, { visibility: 'visible' });
                this.errorNode.innerHTML = utils.stripHTML(this.nls.errorNameEmpty);
                return;
            }

            this._createMapstate();

            html.setStyle(this.errorNode, { visibility: 'hidden' });
            this.errorNode.innerHTML = '&nbsp;';

            var msgText = utils.stripHTML(this.nls.msgSaveSuccess);
            msgText = msgText.replace("%mapName%", this.mapName);
            this.mapstateMsgNode.innerHTML = msgText;
        },

        /*
         * Need to capture the state from the current map (2D only)
         * - extent (x)
         * - visible layers 
         * - drawing 
         */
        _createMapstate: function () {
            LayerInfos.getInstance(this.map, this.map.itemInfo)
                    .then(lang.hitch(this, function (layerInfosObj) {
                        this.layerInfosObj = layerInfosObj;
                        if (this.storeStrategy === "remote") {
                            // transform the state data
                            var stateData = this.MapStateManager._extractMapState(
                                this.map, this.layerInfosObj, this.mapstateName.value);
                            var stateDataText = json.stringify(stateData);
                            xhr(this._composeStoreURL("save"), {
                                method: "POST",
                                handleAs: "json",
                                headers: { "Content-Type": "application/json" },
                                data: json.stringify({
                                    "Name": "hidden",
                                    "StateData": stateDataText
                                })
                            }).then(lang.hitch(this, function (data) {
                                var msgText = utils.stripHTML(this.nls.msgSaveSuccess);
                                msgText = msgText.replace("%mapName%", this.mapName);
                                this.mapstateMsgNode.innerHTML = msgText;
                                // refresh the mapstates variable
                                this.onOpen();
                                // 
                            }), lang.hitch(this, function (err) {
                                var msgText = utils.stripHTML(this.nls.errSaveFailure);
                                msgText = msgText.replace("%mapName%", this.mapName);
                                this.mapstateMsgNode.innerHTML = msgText;
                            }));
                        } else {
                            // by default, use local storage
                            this.MapStateManager.saveMapState(
                                this.map, this.layerInfosObj, this.mapstateName.value);
                            // refresh the mapstates variable
                            this.onOpen();
                            // 	
                        }
                    }));

            this.resize();
        },

        _onDeleteBtnClicked: function () {

            if (!this._canDelete || this.currentIndex === -1) {
                return;
            }

            array.some(this.mapstates, function (b, i) {
                // jshint unused:false
                if (i === this.currentIndex) {
                    this.mapstates.splice(i, 1);
                    return true;
                }
            }, this);

            if (this.storeStrategy === "remote") {
                xhr(this._composeStoreURL("delete"), {
                    method: "POST",
                    handleAs: "json",
                    headers: { "Content-Type": "application/json" }
                }).then(lang.hitch(this, function (data) {
                    var msgText = utils.stripHTML(this.nls.msgDeleteSuccess);
                    msgText = msgText.replace("%mapName%", this.mapName);
                    this.mapstateMsgNode.innerHTML = msgText;
                    // 
                }), lang.hitch(this, function (err) {
                    var msgText = utils.stripHTML(this.nls.errDeleteFailure);
                    msgText = msgText.replace("%mapName%", this.mapName);
                    this.mapstateMsgNode.innerHTML = msgText;
                }));
            } else {
                this.MapStateManager.deleteMapState();

                var msgText = utils.stripHTML(this.nls.msgDeleteSuccess);
                msgText = msgText.replace("%mapName%", this.mapName);
                this.mapstateMsgNode.innerHTML = msgText;
            }

            this.resize();

            this.currentIndex = -1;
            this._switchDeleteBtn();
            this._switchLoadBtn();

            this.displayMapstates();
        },

        _onRestoreBtnClicked: function () {
            console.log("restore to the default view");
            // Reload the current page
            location.reload();
        },

        _onLoadBtnClicked: function () {
            if (this.mapstates && this.mapstates.length > 0) {
                // take the 1st one (assume only one be saved)
                var mapstate = this.mapstates[0];
                //require the module on demand
                this._applyMapstate(mapstate, this.map);
                // 
                var msgText = utils.stripHTML(this.nls.msgLoadSuccess);
                msgText = msgText.replace("%mapName%", this.mapName);
                this.mapstateMsgNode.innerHTML = msgText;
            }
        },

        /*
         * Need to apply the saved state to the current map (2D only)
         * - extent (x)
         * - visible layers 
         * - drawing 
         */
        _onMapstateClick: function (mapstate) {
            array.some(this.mapstates, function (b, i) {
                if (b.displayName === mapstate.displayName) {
                    this.currentIndex = i;
                    return true;
                }
            }, this);

            //require the module on demand
            this._applyMapstate(mapstate, this.map);
        },

        _applyMapstate: function (stateData, map) {
            var layerData = stateData.layers;
            var filterData = stateData.layerDef;
            // set layer visibility
            this.layerInfosObj.restoreState({
                layerOptions: layerData || null
            });
            // set layer opacity and map filters
            array.forEach(this.layerInfosObj.getLayerInfoArray(), function (rootLayerInfo) {
                rootLayerInfo.setOpacity(layerData[rootLayerInfo.id].opacity);
                if (rootLayerInfo.layerObject.type == "Feature Layer") {
                    if (filterData[rootLayerInfo.id].defnExpr[0]) {
                        rootLayerInfo.layerObject.setDefinitionExpression(filterData[rootLayerInfo.id].defnExpr[0])
                    }
                }
                else {
                    if (filterData[rootLayerInfo.id] && filterData[rootLayerInfo.id].defnExpr) {
                        rootLayerInfo.layerObject.setLayerDefinitions(filterData[rootLayerInfo.id].defnExpr)
                    }
                }
            }, this);

            // set map extent
            if (stateData.extent) {
                map.setExtent(stateData.extent);
            }

            //set map graphics
            if (stateData.graphicsLayers.features) {
                var graphics = [];
                for (var i = 0, len = stateData.graphicsLayers.features.length ; i < len ; i++) {
                    var json_feat = stateData.graphicsLayers.features[i];
                    var g = new Graphic(json_feat);
                    if (!g)
                        continue;
                    graphics.push(g);
                }

                //Clear and Add graphics
                var newGlayer;
                if (map.graphicsLayerIds.length > 0) {
                    var gLayers = map.graphicsLayerIds.length;
                    var gLayer;
                    for (var j = 0; j < gLayers; j++) {
                        gLayer = map.getLayer(map.graphicsLayerIds[0]);
                        //gLayer.clear();
                        if (map.graphicsLayerIds[j] == 'Logic') {
                            newGlayer = map.getLayer(map.graphicsLayerIds[j]);
                            newGlayer.clear();
                        }
                        //map.removeLayer(gLayer);
                        //gLayer.clear();
                    }
                }

                //if(map.graphics.graphics.length > 0)
                //{
                //	map.graphics.clear();
                //}
                if (!newGlayer)
                    var newGlayer = new GraphicsLayer({ id: 'Logic' });

                newGlayer.clear();
                for (var j = 0, nb = graphics.length; j < nb; j++) {
                    if (graphics[j])
                        newGlayer.add(graphics[j]);
                }
                map.addLayer(newGlayer);
            }
        },

        _composeStoreURL: function (action) {
            return this.storeServiceUrl + "/" + action
                + "/" + this.userName + "/" + this.map.itemId;
        }

    });
});