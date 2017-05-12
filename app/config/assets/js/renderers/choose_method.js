/**
 * Render the choose method page
 */
'use strict';

var insideQueue = false;
var htmlFileNameValue = "delivery_start";
var userActionValue = "launchBarcode";
var myTimeoutVal = null;
var idComponent = "";
var user;
var locale = odkCommon.getPreferredLocale();
var superUser;
var type = util.getQueryParameter('type');
var code;

function display() {
    $('#view_details').text(odkCommon.localizeText(locale, "view_authorization_details"));
    $('#barcode').text(odkCommon.localizeText(locale, "scan_barcode"));
    $('#search').text(odkCommon.localizeText(locale, "enter"));

    var localizedUser = odkCommon.localizeText(locale, "select_user");
    $('#choose_user').hide();
    if (type != 'ent_override') {
        $('#view_details').hide();
    } else {
        idComponent = "&authorization_id=" + encodeURIComponent(util.getQueryParameter('authorization_id'));
        $('#view_details').on('click', function() {
            odkTables.openDetailView(
                                     null,
                                     'authorizations',
                                     util.getQueryParameter('authorization_id'),
                                     'config/tables/authorizations/html/authorizations_detail.html');
        });
    }
    var userPromise = new Promise(function(resolve, reject) {
        odkData.getUsers(resolve, reject);
    });

    var rolesPromise = new Promise(function(resolve, reject) {
        odkData.getRoles(resolve, reject);
    });

    Promise.all([userPromise, rolesPromise]).then(function(resultArray) {
        console.log(resultArray.length);
        var users = resultArray[0].getUsers();
        var roles = resultArray[1].getRoles();
        superUser = $.inArray('ROLE_SUPER_USER_TABLES', roles) > -1;
        console.log(superUser);
        if (superUser && type != 'activate' && type != 'disable') {
            $('#choose_user').show();
            $('#barcode').prop("disabled", true).addClass('disabled');
            $('#search').prop("disabled", true).addClass('disabled');
            console.log(roles);
            users.forEach(addOption);
            $('#choose_user').append($("<option/>").attr("value", localizedUser).attr('selected', true).text(localizedUser));
            $('#choose_user').on('change', function() {
                if ($('#choose_user').val() != localizedUser) {
                    $('#barcode').prop("disabled", false).removeClass('disabled');
                    $('#search').prop("disabled", false).removeClass('disabled');
                } else {
                    $('#barcode').prop("disabled", true).addClass('disabled');
                    $('#search').prop("disabled", true).addClass('disabled');
                }
            });
        }


        $('#title').text(util.getQueryParameter('title'));

        $('#barcode').on('click', function() {
            window.localStorage.setItem('odk_user', $('#choose_user').val());
            odkCommon.registerListener(function() {
                callBackFn();
            });
            var dispatchString = JSON.stringify({htmlPath:htmlFileNameValue, userAction:userActionValue});
            odkCommon.doAction(dispatchString, 'com.google.zxing.client.android.SCAN', null);
        });
        myTimeoutVal = setTimeout(callBackFn(), 1000);


        $('#search').on('click', function() {
            queryChain($('#code').val());
        });
    }, function(err) {
        console.log('promise failure with error: ' + err);
    });
}

function addOption(item, index) {
    if ($.inArray("ROLE_USER", item.roles) > -1 && $.inArray("ROLE_SUPER_USER_TABLES", item.roles) == -1) {
        $('#choose_user').append($("<option/>").attr("value", item.user_id).text(item.full_name));
    }
}

function callBackFn () {
    if (insideQueue == true) return;
    insideQueue = true;
    var value = odkCommon.viewFirstQueuedAction();
    console.log('callback entered with value: ' + value);
    if ( value !== null && value !== undefined ) {
        var action = JSON.parse(value);
        var dispatchStr = JSON.parse(action.dispatchString);

        console.log("callBackFn: action: " + dispatchStr.userAction + " htmlPath: " + dispatchStr.htmlPath);

        if (dispatchStr.userAction === userActionValue &&
            dispatchStr.htmlPath === htmlFileNameValue &&
            action.jsonValue.status === -1) {
            clearTimeout(myTimeoutVal);
            var scanned = action.jsonValue.result.SCAN_RESULT;
            $('#code').val(scanned);
            odkCommon.removeFirstQueuedAction();
            queryChain(action.jsonValue.result.SCAN_RESULT);
        }
    }
}

function queryChain(passed_code) {
    code = passed_code;
    console.log(code);
    if (type == 'delivery') {
        deliveryFunction();
    } else if (type == 'registration') {
        registrationFunction();
    } else if (type == 'voucher') {
        voucherFunction();
    } else if (type == 'activate' || type == 'disable') {
        regOverrideFunction();
    } else if (type == 'ent_override') {
        entOverrideFunction();
    }
}

function deliveryFunction() {
    if (superUser) {
        odkData.query('registration', 'beneficiary_code = ? and is_active = ? and _filter_value = ?',
                      [code, 'true', user], null, null, null, null, null, null, true,
                      deliveryBCheckCBSuccess, deliveryBCheckCBFailure);
    } else {
        odkData.query('registration', 'beneficiary_code = ? and is_active = ?', [code, 'true'], null,
                      null, null, null, null, null, true, deliveryBCheckCBSuccess, deliveryBCheckCBFailure);
    }
}

function deliveryBCheckCBSuccess(result) {
    console.log('deliveryBCheckCBSuccess called');
    if (result.getCount() === 0) {
        if (superUser) {
            console.log(user);
            odkData.query('registration', 'beneficiary_code = ? and is_active = ? and _filter_value = ?',
                          [code, 'false', user], null, null, null, null, null, null, true,
                          deliveryDisabledCBSuccess, deliveryDisabledCBFailure);
        } else {
            odkData.query('registration', 'beneficiary_code = ? and is_active = ?', [code, 'false'],
                          null, null, null, null, null, null, true,
                          deliveryDisabledCBSuccess, deliveryDisabledCBFailure);
        }
    } else if (result.getCount() === 1) {
        odkTables.openDetailView(
                                 null,
                                 'registration',
                                 result.getRowId(0),
                                 'config/tables/registration/html/registration_detail.html?type=' + type);
        odkCommon.removeFirstQueuedAction();
    } else {
        var params;
        var vals;
        if (superUser) {
            params = 'beneficiary_code = ? and is_active = ? and _filter_value = ?';
            vals = [code,'true', user];
        } else {
            params = 'beneficiary_code = ? and is_active = ?';
            vals = [code,'true'];
        }
        odkTables.openTableToListView(
                                      null,
                                      'registration', params, vals
                                      , 'config/tables/registration/html/registration_list.html?type=' + type);
        odkCommon.removeFirstQueuedAction();
    }
}

function deliveryBCheckCBFailure(error) {
    console.log('deliveryBCheckCBFailure called with error: ' + error);
}

function deliveryDisabledCBSuccess(result) {
    console.log('disabledCB called');
    if (result.getCount() > 0) {
        $('#search_results').text(odkCommon.localizeText(locale, "disabled_beneficiary_notification"));
    } else {
        $('#search_results').text(odkCommon.localizeText(locale, "missing_beneficiary_notification"));

    }
    odkCommon.removeFirstQueuedAction();
}

function deliveryDisabledCBFailure(error) {
    console.log('disableCB failed with error: ' + error);
}

function registrationFunction() {
    console.log('registration function path entered');
    if (superUser) {
        console.log('is superuser');
        odkData.query('registration', 'beneficiary_code = ? and _filter_value = ?', [code, user],
                      null, null, null, null, null, null, true,
                      registrationBCheckCBSuccess, registrationBCheckCBFailure);
    } else {
        odkData.query('registration', 'beneficiary_code = ?', [code], null, null,
                      null, null, null, null, true, registrationBCheckCBSuccess,
                      registrationBCheckCBFailure);
    }
}

function registrationBCheckCBSuccess(result) {
    console.log('registrationBCheckCBSuccess called with value' + result);
    if (result.getCount() === 0) {
        if (superUser) {
            console.log('is superuser');
            odkData.query('entitlements', 'beneficiary_code = ? and _filter_type = ?',
                          [code, "READ_ONLY"], null, null, null, null, null, null, true,
                          registrationVoucherCBSuccess, registrationVoucherCBFailure);
        } else {
            odkData.query('entitlements', 'beneficiary_code = ?', [code], null, null,
                          null, null, null, null, true, registrationVoucherCBSuccess,
                          registrationVoucherCBFailure);
        }

    } else {

        $('#search_results').text(odkCommon.localizeText(locale, "barcode_unavailable"));
        odkCommon.removeFirstQueuedAction();
    }
}

function registrationBCheckCBFailure(error) {
    console.log('registrationBCheckCBFailure called with error: ' + error);
}

function registrationVoucherCBSuccess(result) {
    voucherResultSet = result;
    if (voucherResultSet.getCount() == 0) {
        $('#search_results').text(odkCommon.localizeText(locale, "barcode_available"));
    } else {
        $('#search_results').text(odkCommon.localizeText(locale, "voucher_detected"));
    }
    setTimeout(function() {
        if (superUser) {
            var struct = {};
            struct['beneficiary_code'] = code;
            odkData.addRow('registration', struct, util.genUUID(), proxyRowSuccess, proxyRowFailure);
        } else {
            var jsonMap = {};
            setJSONMap(jsonMap, 'beneficiary_code', code);
            jsonMap = JSON.stringify(jsonMap);
            odkTables.addRowWithSurvey(null, 'registration', 'registration', null, jsonMap);
        }
        odkCommon.removeFirstQueuedAction();
    }, 1000);
}

function registrationVoucherCBFailure(error) {
    console.log('registrationVoucherCBFailure called with error: ' + error);
}

function proxyRowSuccess(result) {
    odkData.changeAccessFilterOfRow('registration', 'HIDDEN', decodeURIComponent(util.getQueryParameter('user')),
                                    result.getRowId(0), setFilterSuccess, setFilterFailure);
}

function proxyRowFailure(error) {
    console.log('proxy set failure with error: ' + error);
}

function setFilterSuccess(result) {
    odkTables.editRowWithSurvey(null, 'registration', result.getRowId(0), 'registration', null);
}

function setFilterFailure(error) {
    console.log('set filter failure with error: ' + error);
}

function setJSONMap(JSONMap, key, value) {
    if (value !== null && value !== undefined) {
        JSONMap[key] = JSON.stringify(value);
    }
}

function getJSONMapValues() {
    var jsonMap = {};
    setJSONMap(jsonMap, 'beneficiary_code', code);
    jsonMap = JSON.stringify(jsonMap);
    return jsonMap;
}

function regOverrideFunction() {
    console.log('entered regoverride path');
    if (code !== "") {
        console.log(code);
        if (type == 'activate') {
            queriedType = 'false';
        } else {
            queriedType = 'true';
        }
        odkData.query('registration', 'beneficiary_code = ? and is_active = ?', [code, queriedType],
                      null, null, null, null, null, null, true,
                      regOverrideBenSuccess, regOverrideBenFailure);
    }
}

function regOverrideBenSuccess(result) {
    //var descriptor;
    //if (type == 'activate') {
    //descriptor = "Disabled";
    ////} else {
    //    descriptor = "Active";
    //}
    if (result.getCount() == 1) {
        odkTables.openDetailView(null, 'registration', result.getRowId(0),
                                 'config/tables/registration/html/registration_detail.html?type=' +
                                 encodeURIComponent(type));
    } else if (result.getCount() > 1) {
        odkTables.openTableToListView(
                                      null,
                                      'registration',
                                      'beneficiary_code = ? and is_active = ?',
                                      [code, queriedType],
                                      'config/tables/registration/html/registration_list.html?type=' +
                                      encodeURIComponent(type));
    } else {
        if (type == 'activate') {
            $('#search_results').text(odkCommon.localizeText(locale, "no_active_beneficiary"));
        } else {
            $('#search_results').text(odkCommon.localizeText(locale, "no_disabled_beneficiary"));
        }
    }
}

function regOverrideBenFailure(error) {
    console.log('regOverrideFailure with error : ' + error)
}


function entOverrideFunction() {
    if (code !== "") {
        odkData.query('registration', 'beneficiary_code = ? and _filter_value = ?',
                      [code, user],
                      null, null, null, null, null, null, true, benEntOverrideCBSuccess,
                      benEntOverrideCBFailure);
    } else {
        $('#search_results').text(odkCommon.localizeText(locale, "enter_beneficiary_code"));
    }
}

function benEntOverrideCBSuccess(result) {
    if (result.getCount() != 0) {
        odkData.query('entitlements', 'beneficiary_code = ? and authorization_id = ? and _filter_value = ?',
                      [code, util.getQueryParameter('authorization_id'), user], null, null, null, null, null,
                      null, true, entCheckCBSuccess, entCheckCBFailure);
    } else {
        $('#search_results').text(odkCommon.localizeText(locale, "missing_beneficiary_notification"));
        odkCommon.removeFirstQueuedAction();
    }
}

function benEntOverrideCBFailure(error) {
    console.log('failed with error: ' + error);
}

function entCheckCBSuccess(result) {
    if (result.getCount() == 0) {
        odkData.query('authorizations', '_id = ?',
                      [util.getQueryParameter('authorization_id')],
                      null, null, null, null, null, null, true, createOverrideCBSuccess,
                      createOverrideCBFailure);
    } else {
        $('#search_results').text(odkCommon.localizeText(locale, "already_qualifies_override"));
    }
}

function entCheckCBFailure(error) {
    console.log('scanCBFailure with error:' + error);
}

function createOverrideCBSuccess(result) {
    $('#search_results').text(odkCommon.localizeText(locale, "eligible_override"));

    var struct = {};
    struct['authorization_id'] = result.get('_id');
    struct['authorization_name'] = result.get('authorization_name');
    struct['item_pack_id'] = result.get('item_pack_id');
    struct['item_pack_name'] = result.get('item_pack_name');
    struct['item_description'] = result.get('item_description');
    struct['ranges'] = result.get('ranges');
    struct['beneficiary_code'] = code;
    struct['is_delivered'] = 'false';
    struct['is_override'] = 'true';
    odkData.addRow('entitlements', struct, util.genUUID(), addDistCBSuccess, addDistCBFailure);
}

function createOverrideCBFailure(error) {
    console.log('createOverride failed with error: ' + error);
}

var addDistCBSuccess = function(result) {
    console.log('authorizations_detail addDistCBSuccess');
    odkData.changeAccessFilterOfRow('entitlements', 'HIDDEN', user, result.getRowId(0),
                                    finalFilterSuccess, finalFilterFailure);
    $('#search_results').text(odkCommon.localizeText(locale, "override_creation_success"));
};

var addDistCBFailure = function(error) {
    console.log('authorizations_detail addDistCBFailure: ' + error);
};

function finalFilterSuccess(result) {
    console.log('final filter success');
}

function finalFilterFailure(error) {
    console.log('final filter failure with error: ' + error);
}
