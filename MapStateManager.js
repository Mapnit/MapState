
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
  ], function(declare, lang, array, Deferred, json, Extent,
    SpatialReference, storejs, md5js, TokenUtils) {
    var instance = null;
    var clazz = declare(null, {
      mapMd5: null,
      mapStateKey: null,

      _getMapStateMd5: function(map) {
        if (typeof this.mapMd5 === 'string') {
          return this.mapMd5;
        } else {
          var str = json.stringify(map);
          this.mapMd5 = md5js(str);
          return this.mapMd5;
        }
      },

      _getMapStateKey: function() {
        if (this.mapStateKey) {
          return this.mapStateKey;
        }

        // xt or integration use id of app as key,
        // deploy app use pathname as key
        this.mapStateKey = 'mapstate_' +  this.token || window.path;
        return this.mapStateKey;
      },
	  
	  _prepareMapState: function(mapState) {
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
		  var graphicsLayers = mapState.map && mapState.map.graphicsLayers;
		  if (graphicsLayers) {
            data.graphicsLayers = graphicsLayers;
          }
		  data.name = mapState.name;
		  
		  data.updateDate = mapState.updateDate; 
		  
		  return data; 
	  }, 

      getMapState: function() {
        var def = new Deferred();
        var data = {};
        var mapStateKey = this._getMapStateKey();

        var mapState = storejs.get(mapStateKey);
        if (mapState && mapState.mapStateMd5 === this._getMapStateMd5()){
          data = this._prepareMapState(mapState); 
        } else {
          storejs.remove(mapStateKey);
        }

        def.resolve(data);

        return def;
      },
	  
	  _extractMapState: function(map, layerInfosObj, mapstateName) {
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
		  graphicsLayers: {}
        };
        if (layerInfosObj && layerInfosObj.traversal) {
          layerInfosObj.traversal(lang.hitch(this, function(layerInfo) {
            mapObj.layers[layerInfo.id] = {
              visible: layerInfo.isVisible(), 
			  opacity: layerInfo.getOpacity(), 
			  layerDefinitions: layerInfo.layerObject.layerDefinitions
            };
          }));
        }
		array.forEach(map.graphicsLayerIds, function(graphicsLayerId) {
			var graphicsLayer = map.getLayer(graphicsLayerId); 
			if (graphicsLayer.graphics && graphicsLayer.graphics.length > 0) {
				mapObj.graphicsLayers[graphicsLayerId] = []; 
				array.forEach(graphicsLayer.graphics, function(graphic) {
					mapObj.graphicsLayers[graphicsLayerId].push(graphic.toJson()); 
				}, this); 
			}
		}, this);
		var now = new Date();
		
		return {
		  name: mapstateName, 
		  updateDate: now.toLocaleString(), 
          map: mapObj,
          mapStateMd5: this._getMapStateMd5()
        }; 
	  }, 

      saveMapState: function(map, layerInfosObj, mapstateName) {        
		var mapState = this._extractMapState(map, layerInfosObj, mapstateName); 
		if (mapState) {
			var key = this._getMapStateKey();
			storejs.set(key, mapState);
		}
      }, 
	  
	  deleteMapState: function() {
		var key = this._getMapStateKey();
		storejs.remove(key);
	  }
    });

    clazz.getInstance = function(token) {
      if (instance === null) {
        instance = new clazz();
      }
      instance.token = token;
      return instance;
    };

    return clazz;
  });