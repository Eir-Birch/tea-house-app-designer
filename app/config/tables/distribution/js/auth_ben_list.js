'use strict';

var idxStart = -1;
var authorizationsResultSet = {};

var authorizationsCBSuccess = function(result) {
    authorizationsResultSet = result;

    return (function() {
        displayGroup(idxStart);
    }());
};

var authorizationsCBFailure = function(error) {

    console.log('auth_ben_list authorizationsCBFailure: ' + error);
}; 

var resumeFn = function(fIdxStart) {  
    odkData.getViewData(authorizationsCBSuccess, authorizationsCBFailure);

    idxStart = fIdxStart;
    console.log('resumeFn called. idxStart: ' + idxStart);
    // The first time through we're going to make a map of typeId to
    // typeName so that we can display the name of each shop's specialty.
    if (idxStart === 0) {
        // We're also going to add a click listener on the wrapper ul that will
        // handle all of the clicks on its children.
        $('#list').click(function(e) {
            // We set the rowId while as the li id. However, we may have
            // clicked on the li or anything in the li. Thus we need to get
            // the original li, which we'll do with jQuery's closest()
            // method. First, however, we need to wrap up the target
            // element in a jquery object.
            // wrap up the object so we can call closest()
            var jqueryObject = $(e.target);
            // we want the closest thing with class item_space, which we
            // have set up to have the row id
            var containingDiv = jqueryObject.closest('.item_space');
            var rowId = containingDiv.attr('rowId');
            console.log('clicked with rowId: ' + rowId);
            var jsonMap = {};
            //jsonMap.beneficiary_code = authorizationsResultSet.get('beneficiary_code');
            //jsonMap.distribution_id = authorizationsResultSet.get('distribution_id');
            //jsonMap.authorization_id = authorizationsResultSet.get('authorization_id');
            //jsonMap.authorization_name = authorizationsResultSet.get('authorization_name');
            //jsonMap.item_pack_id = authorizationsResultSet.get('item_pack_id');
            //jsonMap.item_pack_name = authorizationsResultSet.get('item_pack_name');
            //jsonMap.min_range = authorizationsResultSet.get('min_range');
            //jsonMap.max_range = authorizationsResultSet.get('max_range');



            jsonMap = JSON.stringify(jsonMap);
            // make sure we retrieved the rowId
            if (rowId !== null && rowId !== undefined) {
                // we'll pass null as the relative path to use the default file
                odkTables.addRowWithSurvey(
                  'deployment',
                  'deploy_to_specific',
                  null,
                  jsonMap);
            }
        });
    }
};

var displayGroup = function(idxStart) {
    console.log('displayGroup called. idxStart: ' + idxStart);
    /* Number of rows displayed per 'chunk' - can modify this value */
    var chunk = 50;
    for (var i = idxStart; i < idxStart + chunk; i++) {
      if (i >= authorizationsResultSet.getCount()) {
        break;
      }

      var item = $('<li>');
      item.attr('rowId', authorizationsResultSet.getRowId(i));
      item.attr('class', 'item_space');
      var auth_name = authorizationsResultSet.getData(i, 'authorization_name');
      item.text(auth_name);
              
      /* Creates arrow icon (Nothing to edit here) */
      var chevron = $('<img>');
      chevron.attr('src', odkCommon.getFileAsUrl('config/assets/img/little_arrow.png'));
      chevron.attr('class', 'chevron');
      item.append(chevron);

      $('#list').append(item);

      // don't append the last one to avoid the fencepost problem
      var borderDiv = $('<div>');
      borderDiv.addClass('divider');
      $('#list').append(borderDiv);

    }
    if (i < authorizationsResultSet.getCount()) {
        setTimeout(resumeFn, 0, i);
    }
};