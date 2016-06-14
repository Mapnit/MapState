
define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/Deferred',
  'dojo/json',
  'esri/geometry/Extent',
  'esri/SpatialReference',
  'libs/storejs/store',
  'libs/md5/md5',
  'jimu/tokenUtils'
], function (declare, lang, array, Deferred, json, Extent,
    SpatialReference, storejs, md5js, TokenUtils) {
    var instance = null;
    var clazz = declare(null, {
        mapMd5: null,
        mapStateKey: null,

        _getMapStateMd5: function (map) {
            if (typeof this.mapMd5 === 'string') {
                return this.mapMd5;
            } else {
                var str = json.stringify(map);
                this.mapMd5 = md5js(str);
                return this.mapMd5;
            }
        },

        _getMapStateKey: function () {
            if (this.mapStateKey) {
                return this.mapStateKey;
            }

            this.mapStateKey = 'mapstate_' + this.token || window.path;
            return this.mapStateKey;
        },

        _prepareMapState: function (mapState) {
            var data = {};
            var extent = mapState.map && mapState.map.extent;
            if (extent) {
                data.extent = new Extent(
                  extent.xmin,
                  extent.ymin,
                  extent.xmax,
                  extent.ymax,
                  new SpatialReference(extent.spatialReference)
                );
            }
            var layers = mapState.map && mapState.map.layers;
            if (layers) {
                data.layers = layers;
            }


            data.name = mapState.name;
            data.updateDate = mapState.updateDate;
            data.graphicsLayers = mapState.map.graphicsLayers;
            data.layerDef = mapState.map.layerDef;
            return data;
        },

        getMapState: function () {
            var def = new Deferred();
            var data = {};
            var mapStateKey = this._getMapStateKey();

            var mapState = storejs.get(mapStateKey);
            if (mapState && mapState.mapStateMd5 === this._getMapStateMd5()) {
                data = this._prepareMapState(mapState);
            } else {
                storejs.remove(mapStateKey);
            }

            def.resolve(data);

            return def;
        },

        _getCurrentLayerFilter: function (layerInfo) {

            var result = [];

            if (layerInfo.layerType == "ArcGISMapServiceLayer") {
                if (layerInfo.layerObject) {
                    if (layerInfo.layerObject.layerDefinitions) {
                        result = layerInfo.layerObject.layerDefinitions;
                    }
                }
            } else if (layerInfo.layerObject.getDefinitionExpression()) {
                result.push(layerInfo.layerObject.getDefinitionExpression());
            }

            return result;
        },

        _extractMapState: function (map, layerInfosObj, mapstateName) {
            if (!map) {
                return null;
            }

            var mapObj = {
                mapId: map.itemId,
                extent: {
                    xmin: map.extent.xmin,
                    xmax: map.extent.xmax,
                    ymin: map.extent.ymin,
                    ymax: map.extent.ymax,
                    spatialReference: {
                        wkid: map.extent.spatialReference.wkid,
                        wkt: map.extent.spatialReference.wkt
                    }
                },
                layers: {},
                layerDef: {},
                graphicsLayers: {}

            };
            if (layerInfosObj && layerInfosObj.traversal) {
                layerInfosObj.traversal(lang.hitch(this, function (layerInfo) {
                    mapObj.layers[layerInfo.id] = {
                        visible: layerInfo.isVisible(),
                        opacity: layerInfo.getOpacity(),
                        layerDefinitions: layerInfo.layerObject.layerDefinitions
                    };
                }));
            }

            array.forEach(map.itemInfo.itemData.operationalLayers, lang.hitch(this, function (rootLayerInfo) {
                mapObj.layerDef[rootLayerInfo.id] = {
                    defnExpr: this._getCurrentLayerFilter(rootLayerInfo)
                };

            }), this);

            var now = new Date();
            var content = {
                "features": []
            };

            if (map.graphicsLayerIds.length > 0) {
                var gLayers = map.graphicsLayerIds.length;
                for (var j = 0; j < gLayers; j++) {
                    //if(map.graphicsLayerIds[j] == 'Logic')
                    //	continue;
                    if (map.getLayer(map.graphicsLayerIds[j]).type == "Feature Layer")
                        continue;
                    var nb_graphics = map.getLayer(map.graphicsLayerIds[j]).graphics.length;
                    var graphics = map.getLayer(map.graphicsLayerIds[j]).graphics;
                    for (var i = 0; i < nb_graphics; i++) {
                        var g = graphics[i];
                        if (g) {
                            var json = g.toJson();
                            content["features"].push(json);
                        }
                    }
                }
            }

            if (map.graphics.graphics.length > 0) {
                var nb_graphics = map.graphics.graphics.length;
                var graphics = map.graphics.graphics;
                for (var i = 0; i < nb_graphics; i++) {
                    var g = graphics[i];
                    if (g && g.visible) {
                        var json = g.toJson();
                        content["features"].push(json);
                    }
                }
            }

            if (content.features.length > 0) {
                mapObj.graphicsLayers = content;
            }

            return {
                name: mapstateName,
                updateDate: now.toLocaleString(),
                map: mapObj,
                mapStateMd5: this._getMapStateMd5()
            };
        },

        saveMapState: function (map, layerInfosObj, mapstateName) {
            var mapState = this._extractMapState(map, layerInfosObj, mapstateName);
            if (mapState) {
                var key = this._getMapStateKey();
                storejs.set(key, mapState);
            }
        },

        deleteMapState: function () {
            var key = this._getMapStateKey();
            storejs.remove(key);
        }
    });

    clazz.getInstance = function (token) {
        if (instance === null) {
            instance = new clazz();
        }
        instance.token = token;
        return instance;
    };

    return clazz;
});