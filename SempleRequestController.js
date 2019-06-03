var _    = require('underscore'),
    moment = require('moment');

module.exports = {
    
    index: (req, res) => {
        const _returnNumber = req.param('returnNumber');
        const _masterBatchId = req.param('masterBatchId');
        const _locationId = req.param('locationId');
        const _orderSubType = req.param('orderSubType');
        const _transactionNumber = req.param('transactionNumber');
        const _completionDate = moment().tz('US/Pacific').format('YYYY-MM-DD HH:mm:ss');
        var goodItems = 0;

        async.auto({
            rgaList: ( next ) => {
                RgaList.find({
                    'locationId': _locationId,
                    'returnNumber' : _returnNumber,
                    'transactionNumber' : _transactionNumber 
                }, (err, data) => {
                    next(err, data);
                });
            },

            rgaProcessing: ['rgaList', (next, data) => {
                async.map(data.rgaList, _.bind((header, mapNext) => {
                    if(!goodItems)
                        goodItems = (header.conditions == 1 || header.conditions == '1');
                    
                    RgaProcessing.update({
                        'returnNumber': _returnNumber,
                        'itemNumber': header.itemNumber,
                        'masterBatchId' : _masterBatchId
                    },{
                        'locationId': _locationId,
                        'conditions': header.conditions
                    }).exec( mapNext );
                }, this), next );
            }],

            clearRgaProcessing: ['rgaProcessing', ( next ) => {
                RgaProcessing.destroy({
                    'returnNumber': _returnNumber,
                    'locationId': _locationId,
                    'qtyUnloaded' : 0
                }, (err, data) => {
                    if(err) console.log('clearRgaProcessing err', err);
                    next(err, data);
                });
            }],

            findRgaProcessing : ['clearRgaProcessing', ( next ) => {
                RgaProcessing.find({
                    'returnNumber': _returnNumber,
                    'masterBatchId' : _masterBatchId,
                    'conditions' : 1
                }).exec( (err, data) => {
                    if(err) console.log('findRgaProcessing err', err);
                    next(err, data);
                });
            }],

            updateRgaList: ['findRgaProcessing', (next, data) => {
                var items = _.uniq(_.pluck(data.findRgaProcessing, 'itemNumber'));
                RgaList.update({
                    'returnNumber': _returnNumber,
                    'transactionNumber' : _transactionNumber,
                    'itemNumber': items
                },{
                    'conditions':1
                }, next );
            }],

            batchHeaderUpdate: ['rgaList', 'updateRgaList', 'rgaProcessing', (next, data) => {
                var batchStage = 2;
                if(_orderSubType != 1 && !goodItems){
                    var notScanned = _.filter(data.rgaList, (item) => {
                        return item.inspectedQuantity < item.currentReturnQuantity;
                    });
                    if(notScanned.length){
                        batchStage = 4;
                    }
                    else{
                        batchStage = 5;
                    }
                }

                BatchHeader.update({
                    'masterBatchId': _masterBatchId,
                    'locationId': _locationId
                }, {
                    'batchStage': batchStage
                }, next);
            }],

            batchDetailUpdate: ['rgaList', 'batchHeaderUpdate', (next, data) => {
                var orderStage = data.batchHeaderUpdate[0].batchStage;
                var map;
                
                if(orderStage == 5){
                    map = {
                        'docNumber' : _returnNumber,
                        'locationId': _locationId
                    };
                }
                else{
                    map = {
                        'masterBatchId': _masterBatchId,
                        'locationId': _locationId
                    };
                }

                BatchDetail.update(map, {
                    'orderStage': orderStage
                }, next);
            }],

            rgaSummaryDetail:['rgaList', 'batchDetailUpdate', (next, data) => {
                if(_orderSubType != 1 && !goodItems){
                    RgaSummaryDetail.find({
                        'locationId' : _locationId,
                        'returnNumber' : _returnNumber,
                        'itemNumber' : _.uniq(_.pluck(data.rgaList,'itemNumber'))
                    }, next);
                }
                else{
                    next(null, []);
                }
            }],

            createRgaSummaryDetail: ['rgaList', 'rgaSummaryDetail', (next, data) => {
                if(_orderSubType != 1 && !goodItems){
                    var forUpdate = [];
                    var forCreate = [];
                        for(var i = 0; i < data.rgaList.length; i++){
                            var itemSummary = _.findWhere(data.rgaSummaryDetail, {
                                'locationId' : _locationId,
                                'returnNumber' : _returnNumber,
                                'itemNumber' : data.rgaList[i].itemNumber
                            });

                            if(itemSummary){
                                forUpdate.push({
                                    'locationId' : _locationId,
                                    'returnNumber' : _returnNumber,
                                    'itemNumber' : data.rgaList[i].itemNumber,
                                    'qtyReceived' : itemSummary.qtyReceived + data.rgaList[i].inspectedQuantity
                                });
                            }
                            else{
                                forCreate.push({
                                    'locationId' : _locationId,
                                    'returnNumber' : _returnNumber,
                                    'itemNumber' : data.rgaList[i].itemNumber,
                                    'qtyAuthorized' : data.rgaList[i].currentReturnQuantity,
                                    'qtyReceived' : data.rgaList[i].inspectedQuantity || 0
                                });
                            }
                        }
                        
                        async.auto({
                            
                            update: ( next ) => {
                                if(forUpdate && forUpdate.length){
                                    async.map(forUpdate, _.bind((item, mapNext) => {
                                        RgaSummaryDetail.update({
                                            'locationId' : _locationId,
                                            'returnNumber' : _returnNumber,
                                            'itemNumber' : item.itemNumber},
                                            {'qtyReceived' : item.qtyReceived }
                                        , mapNext);
                                    }, this), next);
                                }
                                else{
                                    next(null, null);
                                }
                            },
                            create: ['update', ( next ) => {
                                if(forCreate && forCreate.length){
                                    RgaSummaryDetail.create(forCreate, next);
                                }
                                else{
                                    next(null, null);
                                }
                            }]
                        }, next);
                    //});
                }
                else{
                    next(null, []);
                }
            }],

            rgaControlHeaderUpdate: ['createRgaSummaryDetail', ( next ) => {
                if(_orderSubType != 1 && !goodItems){
                    RgaControlHeader.update({
                        'returnNumber': _returnNumber,
                        'locationId': _locationId
                    },{
                        'completionDate': _completionDate,
                    }).exec( next);
                }
                else{
                    next(null, []);
                }
            }],

            rgaControlDetailUpdate: ['rgaControlHeaderUpdate', ( next ) => {
                if(_orderSubType != 1 && !goodItems){
                    RgaControlDetail.update({
                        'returnNumber': _returnNumber,
                        'locationId': _locationId,
                        'transactionNumber': _transactionNumber
                    }, {
                        'completionDate': _completionDate,
                    }).exec( next);
                }
                else{
                    next(null, []);
                }
            }],
            prepareRgaScanData: ['batchHeaderUpdate', 'createRgaSummaryDetail','rgaControlDetailUpdate', ( next ) => {
                if(_orderSubType != 1 && !goodItems){
                    var query = `SELECT RP.locationId, RP.returnNumber, RP.itemNumber, sum(qtyAuthorized) qtyAuthorized, 
                        sum(qtyUnloaded) qtyReceived, RP.locator AS locatorReceived, "${_completionDate}" AS completionDate, 
                        RP.transactionNumber, "${_completionDate}" AS createdAt, 0 AS sync, 1 AS version, 
                        (SELECT DISTINCT lineNumber FROM xxgen_rgaList_WORK RL WHERE returnNumber="${_returnNumber}" 
                            AND transactionNumber=${_transactionNumber} AND locationId=${_locationId} 
                            AND RL.itemNumber=RP.itemNumber LIMIT 1) lineNumber, 
                        (SELECT DISTINCT itemId FROM xxgen_item_locator_MAIN IL WHERE locationId=8${_locationId}
                            AND IL.itemNumber=RP.itemNumber LIMIT 1 ) itemId,
                        (SELECT DISTINCT itemId FROM xxgen_item_dimensions_v ID WHERE 
                            ID.item_number=RP.itemNumber LIMIT 1 ) itemId2 
                        FROM xxgen_rga_processing_WORK RP 
                        WHERE returnNumber="${_returnNumber}" 
                        AND transactionNumber=${_transactionNumber}
                        AND locationId=${_locationId} 
                        GROUP BY RP.itemNumber, RP.locator`;

                    RgaProcessing.query(query, next);
                }
                else{
                    next(null, []);
                }
            }],
            createRgaScan : ['prepareRgaScanData', (next, bqData) => {
                if(bqData.prepareRgaScanData && bqData.prepareRgaScanData.length){

                    for (let i=0; i < bqData.prepareRgaScanData.length; i++){
                        if(!bqData.prepareRgaScanData[i].itemId){
                            bqData.prepareRgaScanData[i].itemId = bqData.prepareRgaScanData[i].itemId2 || '0';
                        }
                    }

                    WarehouseRgaScan.create(bqData.prepareRgaScanData, next);
                }
                else{
                    next(null, []);
                }
            }],
            sendReport: ['createRgaScan', 'batchHeaderUpdate', (next, data) => {
                var orderStage = data.batchHeaderUpdate[0].batchStage;
                
                if(orderStage == 5){
                    RgaUtils.sendReport({
                        'returnNumber': _returnNumber,
                        'locationId': _locationId,
                        'transactionNumber': _transactionNumber,
                        'masterBatchId': _masterBatchId
                    }, next);
                }
                else{
                    next(null, null);
                }
            }]
        }, (err, data) => {
            if (err) {
                console.log('complete err', err);
                res.send(500, { error: err });
            } else {
                res.json(data.rgaProcessing);
            }
        });
    }
};

module.exports.blueprints = {
    actions: true,
    rest: false,
    shortcuts: false
};
