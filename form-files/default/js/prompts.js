/*jslint eqeq: true, evil: true, plusplus: true, todo: true, vars: true, white: true, devel: true */
'use strict';
/**
 * All  the standard prompts available to a form designer.
 */
define(['mdl','database','opendatakit','controller','backbone','handlebars','promptTypes','builder','jquery','underscore', 'translations', 'handlebarsHelpers'],
function(mdl,  database,  opendatakit,  controller,  Backbone,  Handlebars,  promptTypes,  builder,  $,       _,            translations) {

promptTypes.base = Backbone.View.extend({
    className: "current",
    type: "base",
    database: database,
    constraint_message: "Constraint violated.",
	invalid_value_message: "Invalid value.",
	required_message: "Required value not provided.",
    //renderContext is a dynamic object to be passed into the render function.
    renderContext: {},
    //Template context is an user specified object that overrides the render context.
    templateContext: {},
    baseInputAttributes: {},
    //inputAttributes overrides baseInputAttributes
    inputAttributes: {},
    initialize: function() {
        //this.initializeTemplate();
        this.initializeRenderContext();
        this.afterInitialize();
    },
    whenTemplateIsReady: function(ctxt){
        var that = this;
        if(this.template) {
            ctxt.success();
        } else if(this.templatePath) {
            requirejs(['text!'+this.templatePath], function(source) {
                try {
                    that.template = Handlebars.compile(source);
                    ctxt.success();
                } catch (e) {
                    ctxt.append("prompts."+that.type+".whenTemplateIsReady.exception", e);
                    console.error(e);
                    console.error(that);
                    ctxt.failure({message: "Error compiling handlebars template."});
                }
            }, function(err) {
                ctxt.append("prompts."+that.type+".whenTemplateIsReady.requirejs.failure", err);
                console.error(err);
                console.error(that);
                ctxt.failure({message: "Error loading handlebars template."});
            });
        } else {
            ctxt.append("prompts." + this.type + ".whenTemplateIsReady.noTemplate", "px: " + this.promptIdx);
            alert("No template for prompt: " + prompt.name);
            console.error(this);
            ctxt.failure({message: "Configuration error: No handlebars template found!"});
        }
    },
    /*
    // track how many times we've tried to retrieve and compile the 
    // handlebars template for this prompt.
    initializeTemplateMaxTryCount: 4,
    initializeTemplateTryCount: 0,
    initializeTemplateFailed: false,
    initializeTemplate: function() {
        return;
        
        //if (this.template != null) return;
        var that = this;
        var f = function() {
            if(that.templatePath){
                that.initializeTemplateTryCount++;
                requirejs(['text!'+that.templatePath], function(source) {
                    that.template = Handlebars.compile(source);
                }, function(err) {
                    if ( err.requireType == "timeout" ) {
                        if ( that.initializeTemplateTryCount >
                                that.initializeTemplateMaxTryCount ) {
                            that.initializeTemplateFailed = true;
                        } else {
                            setTimeout( f, 100);
                        }
                    } else {
                        that.initializeTemplateFailed = true;
                    }
                });
            }
        };
        f();
        
    },
    */
    //TODO: I think we can remove isInitializeComplete
    isInitializeComplete: function() {
        return (this.templatePath == null || this.template != null);
    },
    initializeRenderContext: function() {
        //Object.create is used because we don't want to modify the class's render context.
        this.renderContext = Object.create(this.renderContext);
        this.renderContext.label = this.label;
        this.renderContext.name = this.name;
        this.renderContext.disabled = this.disabled;
        this.renderContext.image = this.image;
        this.renderContext.audio = this.audio;
        this.renderContext.video = this.video;
        this.renderContext.hide = this.hide;
        this.renderContext.hint = this.hint;
        this.renderContext.required = this.required;
        //It's probably not good to get data like this in initialize
        //Maybe it would be better to use handlebars helpers to get metadata?
        this.renderContext.formTitle = database.getTableMetaDataValue('formTitle');
        this.renderContext.formVersion = database.getTableMetaDataValue('formVersion');
        this.renderContext.inputAttributes = $.extend({}, this.baseInputAttributes, this.inputAttributes);
        $.extend(this.renderContext, this.templateContext);
    },
    /**
     * afterInitialize is user defined
     **/
    afterInitialize: function() {},
    /**
     * prompt types that override onActivate are expected to call baseActivate
     **/
    baseActivate: function(ctxt) {
        var that = this;
        function callFunctionsInSeries(functions){
            if(functions.length > 0){
                functions[0]($.extend({}, ctxt, { success : function(){callFunctionsInSeries(functions.slice(1));}}))
            } else {
                that.whenTemplateIsReady(ctxt);
            }
        }
        callFunctionsInSeries(that.additionalActivateFunctions);
    },
    onActivate: function(ctxt) {
        this.baseActivate(ctxt);
    },
    /**
     * stopPropagation is used in the events map to disable swiping on various elements
     **/
    stopPropagation: function(evt){
        console.log('stopProp');
        console.log(evt);
        evt.stopImmediatePropagation();
    },
    afterRender: function() {},
    render: function() {
        var that = this;
        //A virtual element is created so images can be loaded before the newly rendered screen is shown.
        //I think there is a better way to do this. meteor.js uses an approach were you add template markup to indicate
        //which elements should not be rerendered.
        //This is better because we don't have to wait for images to reload,
        //and it has the additional benefit of making it so we don't loose focus on input fields.
        var $virtualEl = $('<div>');
        var $imagesToLoad;
        var numImagesLoaded = 0;
        function imagesLoaded(){
            that.$el.empty();
            that.$el.append($virtualEl.children());
            that.$el.trigger('create');
        }
        try {
            $virtualEl.html(this.template(this.renderContext));
        } catch(e) {
            alert("Error in template.");
            console.error(e);
            console.error(that);
        }
        $imagesToLoad = $virtualEl.find('img');
        $imagesToLoad.load(function(){
            numImagesLoaded++;
            if(numImagesLoaded === $imagesToLoad.length) {
                imagesLoaded();
            }
        });
        if($imagesToLoad.length === 0) {
            imagesLoaded();
        }
        //If the images don't load after 1 second render the template anyways.
        setTimeout(function(){
            if(numImagesLoaded < $imagesToLoad.length) {
                imagesLoaded();
                //prevent imagesLoaded from being triggered by late images.
                numImagesLoaded = $imagesToLoad.length + 1;
            }
        },1000);
        this.afterRender();
        return this;
    },
    /**
     * baseValidate isn't meant to be overidden or called externally.
     * It does validation that will be common to most prompts.
     * Validate is meant be overridden and publicly called. 
     * It is validate's responsibility to call baseValidate.
     **/
    baseValidate: function(context) {
        var that = this;
        var isRequired = false;
        try {
            isRequired = that.required ? that.required() : false;
        } catch (e) {
            if ( context.strict ) {
                context.append("prompts."+that.type+".baseValidate.required.exception.strict", e);
                context.failure({message: "Exception while evaluating required() expression. See console log."});
                return;
            } else {
                context.append("prompts."+that.type+".baseValidate.required.exception.ignored", e);
                isRequired = false;
            }
        }
        that.valid = true;
        if ( !('name' in that) ) {
            // no data validation if no persistence...
            context.success();
            return;
        } 
        var value = that.getValue();
        if ( value == null || value == "" ) {
            if ( isRequired ) {
                that.valid = false;
                context.failure({ message: that.required_message });
                return;
            }
        } else if ( 'validateValue' in that ) {
            if ( !that.validateValue() ) {
                that.valid = false;
                context.failure({ message: that.invalid_value_message });
                return;
            }
        } 
        if ( 'constraint' in that ) {
            var outcome = false;
            try {
                outcome = that.constraint({"allowExceptions":true});
                if ( !outcome ) {
                    that.valid = false;
                    context.failure({ message: that.constraint_message });
                    return;
                }
            } catch (e) {
                context.append("prompts."+that.type+"baseValidate.constraint.exception", e);
                outcome = false;
                that.valid = false;
                context.failure({ message: "Exception in constraint." });
                return;
            }
        }
        context.success();
    },
    validate: function(context) {
        return this.baseValidate(context);
    },
    getValue: function() {
        if (!this.name) {
            console.error(this);
            throw "Cannot get value of prompt with no name.";
        }
        return database.getDataValue(this.name);
    },
    setValue: function(ctxt, value) {
        // NOTE: data IS NOT updated synchronously. Use callback!
        var that = this;
        database.setData(ctxt, that.name, value);
    },
    beforeMove: function(ctxt) {
        ctxt.append("prompts." + this.type, "px: " + this.promptIdx);
        ctxt.success();
    },
    getCallback: function(ctxt, path, action) {
        ctxt.append("prompts." + this.type, "px: " + this.promptIdx + " unimplemented: " + path + " action: " + action);
        alert('getCallback: Unimplemented: ' + action);
        ctxt.failure({message: "Unimplemented intent callback."});
    },
    /*
    registerChangeHandlers: function() {
        // TODO: code that is executed after all page prompts are inserted into the DOM.
        // This code would, e.g., handle value-change events to propagate changes across
        // a page (e.g., update calculated fields).
    },
    */
    /*
    //TODO: I can't find any refrences to these, so we should probably remove them.
    validationFailedAction: function(isMoveBackward) {
        alert(this.validationFailedMessage);
    },
    requiredFieldMissingAction: function(isMovingBackward) {
        alert(this.requiredFieldMissingMessage);
    }
    */
});
promptTypes.opening = promptTypes.base.extend({
    type: "opening",
    hideInHierarchy: true,
    templatePath: "templates/opening.handlebars",
    onActivate: function(ctxt) {
        var that = this;
        var formLogo = false;//TODO: Need way to access form settings.
        if(formLogo){
            this.renderContext.headerImg = formLogo;
        }
        var instanceName = database.getInstanceMetaDataValue('instanceName');
        if ( instanceName == null ) {
            // construct a friendly name for this form... use just the date, as the form name is well known
            var date = new Date();
            var dateStr = date.toISOString();
            instanceName = dateStr; // .replace(/\W/g, "_")
            that.renderContext.instanceName = instanceName;
            database.setInstanceMetaData($.extend({}, ctxt, {
                success: function() { 
                    that.baseActivate($.extend({}, ctxt, {
                                        success:function(){
                                ctxt.success({enableBackwardNavigation: false});
                            }
                        }));
                }}), 'instanceName', instanceName);
            return;
        }
        that.renderContext.instanceName = instanceName;
        that.baseActivate($.extend({}, ctxt, {
            success:function(){
                ctxt.success({enableBackwardNavigation: false});
            }
        }));
    },
    renderContext: {
        headerImg: opendatakit.baseDir + 'img/form_logo.png',
        backupImg: opendatakit.baseDir + 'img/backup.png',
        advanceImg: opendatakit.baseDir + 'img/advance.png'
    },
    //Events copied from input_type, should probably refactor.
    events: {
        "change input": "modification",
        "swipeleft .input-container": "stopPropagation",
        "swiperight .input-container": "stopPropagation"
    },
    modification: function(evt) {
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".modification", "px: " + this.promptIdx);
        database.setInstanceMetaData(ctxt, 'instanceName', this.$('input').val());
    },
    beforeMove: function(ctxt) {
        ctxt.append("prompts." + this.type + ".beforeMove", "px: " + this.promptIdx);
        database.setInstanceMetaData(ctxt, 'instanceName', this.$('input').val());
        // ctxt.success();
    }
});
promptTypes.finalize = promptTypes.base.extend({
    type:"finalize",
    hideInHierarchy: true,
    valid: true,
    templatePath: "templates/finalize.handlebars",
    events: {
        "click .incomplete": "saveIncomplete",
        "click .finalize": "saveFinal"
    },
    renderContext: {
        headerImg: opendatakit.baseDir + 'img/form_logo.png'
    },
    onActivate: function(ctxt) {
        var formLogo = false;//TODO: Need way to access form settings.
        if(formLogo){
            this.renderContext.headerImg = formLogo;
        }
        this.renderContext.instanceName = database.getInstanceMetaDataValue('instanceName');
        this.baseActivate($.extend({}, ctxt, {
            success:function(){
                ctxt.success({enableForwardNavigation: false});
            }
        }));
    },
    saveIncomplete: function(evt) {
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".saveIncomplete", "px: " + this.promptIdx);
        controller.saveAllChanges(ctxt,false);
    },
    saveFinal: function(evt) {
         var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".saveFinal", "px: " + this.promptIdx);
        controller.saveAllChanges(ctxt,true);
    }
});
promptTypes.json = promptTypes.base.extend({
    type:"json",
    hideInHierarchy: true,
    valid: true,
    templatePath: "templates/json.handlebars",
    onActivate: function(ctxt) {
        var that = this;
        if ( JSON != null ) {
            that.renderContext.value = JSON.stringify(database.getAllDataValues(),null,2);
        } else {
            that.renderContext.value = "JSON Unavailable";
        }
        that.baseActivate($.extend({}, ctxt, {
            success:function(){
                ctxt.success({enableNavigation: false});
            }
        }));
    }
});
promptTypes.instances = promptTypes.base.extend({
    type:"instances",
    hideInHierarchy: true,
    valid: true,
    templatePath: "templates/instances.handlebars",
    events: {
        "click .openInstance": "openInstance",
        "click .deleteInstance": "deleteInstance",
        "click .createInstance": "createInstance"
    },
    onActivate: function(ctxt) {
        var that = this;
        ctxt.append("prompts." + this.type + ".onActivate", "px: " + this.promptIdx);
		database.get_all_instances($.extend({},ctxt,{
			success:function(instanceList) {
				that.renderContext.instances = instanceList;
				$.extend(that.renderContext, {
					formTitle: opendatakit.getSettingValue('formTitle'),
					headerImg: opendatakit.baseDir + 'img/form_logo.png'
				});
				that.baseActivate($.extend({}, ctxt, {
					success:function(){
						ctxt.success({
							showHeader: false,
							enableNavigation:false,
							showFooter:false
						});
					}
				}));
        }}));
    },
    createInstance: function(evt){
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".createInstance", "px: " + this.promptIdx);
        evt.stopPropagation(true);
        opendatakit.openNewInstanceId(ctxt, null);
    },
    openInstance: function(evt) {
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".openInstance", "px: " + this.promptIdx);
        evt.stopPropagation(true);
        opendatakit.openNewInstanceId(ctxt, $(evt.target).attr('id'));
    },
    deleteInstance: function(evt){
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".deleteInstance", "px: " + this.promptIdx);
        var that = this;
        database.delete_all($.extend({}, ctxt,{
                    success:function() {
                        that.onActivate($.extend({}, ctxt,{
                            success:function(){that.render();ctxt.success();}}));
                }}), 
                $(evt.target).attr('id'));
    }
});
promptTypes.hierarchy = promptTypes.base.extend({
    type:"hierarchy",
    hideInHierarchy: true,
    valid: true,
    templatePath: 'templates/hierarchy.handlebars',
    events: {
    },
    onActivate: function(ctxt) {
        this.renderContext.prompts = controller.prompts;
        this.baseActivate($.extend({}, ctxt, {
            success:function(){
                ctxt.success({showHeader: true, showFooter: false});
            }
        }));
    }
});
promptTypes.repeat = promptTypes.base.extend({
    type: "repeat",
    valid: true,
    templatePath: 'templates/repeat.handlebars',
    events: {
        "click .openInstance": "openInstance",
        "click .deleteInstance": "deleteInstance",
        "click .addInstance": "addInstance"
    },
    onActivate: function(ctxt) {
        var that = this;
        var subsurveyType = this.param;
        ctxt.append("prompts." + this.type + ".onActivate", "px: " + this.promptIdx);
		database.get_all_instances($.extend({},ctxt,{
			success:function(instanceList) {
				that.renderContext.instances = instanceList;
				that.baseActivate($.extend({}, ctxt, {
					success:function(){
						ctxt.success({
							showHeader: false,
							enableNavigation:false,
							showFooter:false
						});
					}
				}));
        }}), subsurveyType);
    },
    openInstance: function(evt) {
        var instanceId = $(evt.target).attr('id');
    },
    deleteInstance: function(evt) {
        var instanceId = $(evt.target).attr('id');
    },
    addInstance: function(evt) {
        //TODO: Launch new instance of collect
    }
});
promptTypes.select = promptTypes.select_multiple = promptTypes.base.extend({
    type: "select",
    templatePath: "templates/select.handlebars",
    events: {
        "change input": "modification",
        //Only needed for child views
        "click .deselect": "deselect",
        "click .grid-select-item": "selectGridItem"
    },
    selectGridItem: function(evt) {
        var $target = $(evt.target).closest('.grid-select-item');
        var $input = $target.find('input');
        $input.prop("checked", function(index, oldPropertyValue) {
            if( oldPropertyValue ) {
                $input.prop("checked", false);
                $input.change();
            } else {
                $input.prop("checked", true);
                $input.change();
            }
        });
    },
    choice_filter: function(){ return true; },
    updateRenderValue: function(formValue) {
        var that = this;
        //that.renderContext.value = formValue;
        var filteredChoices = _.filter(that.renderContext.choices, function(choice) {
            return that.choice_filter(choice);
        });
        if(this.appearance === "grid") {
            filteredChoices = _.map(filteredChoices, function(choice, idx) {
                var columns = 3;
                choice.colLetter = String.fromCharCode(97 + (idx % columns));
                return choice;
            });
        }
        if ( !formValue ) {
            that.renderContext.choices = _.map(filteredChoices, function(choice) {
                choice.checked = false;
                return choice;
            });
            return;
        }
        //Check appropriate choices based on formValue
        that.renderContext.choices = _.map(filteredChoices, function(choice) {
            choice.checked = _.any(formValue, function(valueObject) {
                return choice.name === valueObject.value;
            });
            return choice;
        });
        if(this.withOther) {
            var otherObject = _.find(formValue, function(valueObject) {
                return ('otherValue' === valueObject.name);
            });
            that.renderContext.other = {
                value: otherObject ? otherObject.value : '',
                checked: _.any(formValue, function(valueObject) {
                    return ('other' === valueObject.value);
                })
            };
        }
    },
    generateSaveValue: function(jsonFormSerialization) {
        return jsonFormSerialization ? JSON.stringify(jsonFormSerialization) : null;
    },
    parseSaveValue: function(savedValue) {
        return savedValue ? JSON.parse(savedValue) : null;
    },
    modification: function(evt) {
        if(this.withOther) {
            //This hack is needed to prevent rerendering
            //causing the other input to loose focus when clicked.
            if($(evt.target).val() === 'other' && this.renderContext.other.checked) {
                return;
            }
        }
        if(this.appearance === 'grid') {
            //Make selection more reponsive by providing visual feedback before
            //the template is re-rendered.
            this.$('.grid-select-item.ui-bar-e').removeClass('ui-bar-e').addClass('ui-bar-c');
            this.$('input:checked').closest('.grid-select-item').addClass('ui-bar-e');
        }
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".modification", "px: " + this.promptIdx);
        var that = this;
        console.log("select modification");
        console.log(this.$('form').serializeArray());
        var formValue = (this.$('form').serializeArray());
        this.setValue($.extend({}, ctxt, {
            success: function() {
                that.updateRenderValue(formValue);
                that.render();
                ctxt.success();
            }
        }), this.generateSaveValue(formValue));
    },
    onActivate: function(ctxt) {
        var that = this;
        var query;
        that.renderContext.appearance = this.appearance;
        if(that.param in that.form.queries) {
            query = that.form.queries[that.param];
            //TODO: Come up with a tables uri and when we get that kind of uri do tables queries.
            $.ajax({
                "type": 'GET',
                "url": query.uri(),
                "dataType": 'json',
                "data": {},
                "success": function(result) {
                    that.renderContext.choices = query.callback(result);
                    that.updateRenderValue(that.parseSaveValue(that.getValue()));
                    that.baseActivate(ctxt);
                },
                "error": function(e) {
                    console.error(e);
                    alert('Could not get remote data');
                }
            });
            return;
        } else if (that.param in that.form.choices) {
            //Very important.
            //We need to clone the choices so their values are unique to the prompt.
            that.renderContext.choices = _.map(that.form.choices[that.param], _.clone);
        }
        that.updateRenderValue(that.parseSaveValue(that.getValue())); 
        that.baseActivate(ctxt);
    },
    deselect: function(evt) {
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + this.type + ".deselect", "px: " + this.promptIdx);
        this.$('input:checked').prop('checked', false).change();
    }
});
promptTypes.select_one = promptTypes.select.extend({
    renderContext: {
        "select_one": true,
        "deselect" : translations.deselect
    },
    generateSaveValue: function(jsonFormSerialization) {
        var otherSelected, otherValue;
        if(jsonFormSerialization){
            if(jsonFormSerialization.length > 0){
                if(this.withOther) {
                    otherSelected = _.any(jsonFormSerialization, function(valueObject) {
                        return ('other' === valueObject.value);
                    });
                    if(otherSelected) {
                        otherValue = _.find(jsonFormSerialization, function(valueObject) {
                            return ('otherValue' === valueObject.name);
                        });
                        return (otherValue ? otherValue.value : '');
                    }
                }
                return jsonFormSerialization[0].value;
            }
        }
        return null;
    },
    parseSaveValue: function(savedValue){
        //Note that this function expects to run after renderContext.choices
        //has been initilized.
        var inChoices = _.any(this.renderContext.choices, function(choice){
            return choice.name === savedValue;
        });
        if (inChoices) {
            return [{
                "name": this.name,
                "value": savedValue
            }];
        }
        else {
            return [{
                "name": "other",
                "value": "other"
            }, {
                "name": "otherValue",
                "value": savedValue
            }];
        }
    }
});
promptTypes.select_one_with_other = promptTypes.select_one.extend({
    withOther: true
});
//TODO:
//Since multiple choices are possible should it be possible
//to add arbitrary many other values to a select_with_other?
promptTypes.select_with_other = promptTypes.select.extend({
    withOther: true
});
promptTypes.input_type = promptTypes.text = promptTypes.base.extend({
    type: "text",
    templatePath: "templates/input_type.handlebars",
    renderContext: {
        "type": "text"
    },
    events: {
        "change input": "modification",
        "swipeleft .input-container": "stopPropagation",
        "swiperight .input-container": "stopPropagation"
    },
    //a debounced function will postpone execution until after wait (parameter 2)
    //milliseconds have elapsed since the last time it was invoked.
    //Useful for sliders.
    //It might be better to listen for the jQm event for when a slider is released.
    //This could cause problems since the debounced function could fire after a page change.
    debouncedRender: _.debounce(function() {
        this.render();
    }, 500),
    //This has to be debounced for the slider to work.
    //However, debouncing might cause an event ordering problem in screen groups
    //if a select is clicked to unfocus an input box.
    modification: _.debounce(function(evt) {
        var value = $(evt.target).val();
        var that = this;
        var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + that.type + ".modification", "px: " + that.promptIdx);
        var renderContext = that.renderContext;
        that.setValue($.extend({}, ctxt, {
            success: function() {
                renderContext.value = value;
                renderContext.invalid = !that.validateValue();
                that.debouncedRender();
                ctxt.success();
            },
            failure: function(m) {
                renderContext.value = value;
                renderContext.invalid = true;
                that.debouncedRender();
                ctxt.failure(m);
            }
        }), (value.length === 0 ? null : value));
    }, 500),
    onActivate: function(ctxt) {
        var renderContext = this.renderContext;
        var value = this.getValue();
        renderContext.value = value;
        this.baseActivate(ctxt);
    },
    beforeMove: function(ctxt) {
        var that = this;
        that.setValue(ctxt, this.$('input').val());
    },
    validateValue: function() {
        return true;
    }
});
promptTypes.integer = promptTypes.input_type.extend({
    type: "integer",
    baseInputAttributes: {
        'type':'number'
    },
    invalidMessage: "Integer value expected",
    validateValue: function() {
        return !isNaN(parseInt(this.getValue(), 10));
    }
});
promptTypes.decimal = promptTypes.input_type.extend({
    type: "decimal",
    //TODO: This doesn't seem to be working.
    baseInputAttributes: {
        'type':'number'
    },
    invalidMessage: "Numeric value expected",
    validateValue: function() {
        return !isNaN(parseFloat(this.getValue()));
    }
});
promptTypes.datetime = promptTypes.input_type.extend({
    type: "datetime",
    useMobiscroll: true,
    scrollerAttributes: {
        preset: 'datetime',
        theme: 'jqm',
		display: 'modal'
        //Avoiding inline display because there
        //can be some debouncing issues.
        //Warning: mixed/clickpick mode doesn't work on galaxy nexus.
        //mode: 'scroll'
    },
    events: {
        "change input": "modification",
        "swipeleft input": "stopPropagation",
        "swiperight input": "stopPropagation"
    },
    detectNativeDatePicker: function (){
        //For now never use the native datepicker because the samsung note's
        //native datepicker causes the webkit to freeze in some cases.
        return false;
        /*
        //It may be best to user modernizr for this type of functionality.
        var input = document.createElement('input');
        input.setAttribute('type', this.type);
        //See if the date/time type is allowed.
        if(input.type === this.type){
            //See if the input can hold non-date/time values.
            input.value = 'test';
            if (input.value !== 'test') {
                return true;
            }
        }
        return false;
        */
    },
    onActivate: function(ctxt) {
        var that = this;
        var renderContext = this.renderContext;
        if(this.detectNativeDatePicker()){
            renderContext.inputAttributes.type = this.type;
            this.useMobiscroll = false;
            that.baseActivate(ctxt);
        } else {
            require(["mobiscroll"], function() {
                $.scroller.themes.jqm.defaults = {
                    jqmBody: 'd',
                    jqmHeader:'d',
                    jqmWheel: 'd',
                    jqmClickPick: 'd',
                    jqmSet: 'd',
                    jqmCancel: 'd'
                };
                //This is a monkey patch to disable hiding the datepicker when clicking outside of it.
                //This is a problem because users may click twice while they wait for the date
                //picker to open inadvertantly causing it to close.
                var originalJqmInit = $.scroller.themes.jqm.init;
                $.scroller.themes.jqm.init = function(elm, inst) {
                    originalJqmInit(elm, inst);
                    $('.dwo', elm).off('click');
                    $('.dwo').css("background-color", "white");
                    $('.dwo').css("opacity", ".5");
                };
                that.baseActivate(ctxt);
            });
        }
    },
    modification: function(evt) {
		var that = this;
        var value = that.$('input').scroller('getDate');
		var ref = that.getValue();
		var rerender = ((ref == null || value == null) && (ref != value )) ||
				(ref != null && value != null && ref.valueOf() != value.valueOf());
		var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + that.type + ".modification", "px: " + that.promptIdx);
        var renderContext = that.renderContext;
		if ( value == null ) {
			renderContext.value = '';
		} else {
			renderContext.value = that.$('input').val();
		}
        that.setValue($.extend({}, ctxt, {
            success: function() {
                renderContext.invalid = !that.validateValue();
				if ( rerender ) {
					that.debouncedRender();
				}
                ctxt.success();
            },
            failure: function(m) {
                renderContext.invalid = true;
				if ( rerender ) {
					that.debouncedRender();
				}
                ctxt.failure(m);
            }
        }), value);
    },
    
    afterRender: function() {
        var that = this;
        /*
        //TODO: This will have problems with image labels.
        that.$el.html(that.template(that.renderContext));
        //Triggering create seems to prevent some issues where jQm styles are not applied.
        that.$el.trigger('create');
        */
		if(this.useMobiscroll){
				that.$('input').scroller(that.scrollerAttributes);
			var value = that.getValue();
			if ( value == null ) {
				that.$('input').val
				that.$('input').scroller('setDate',new Date(),false);
			} else {
				that.$('input').scroller('setDate',value, true);
			}
			return this;
		}
	},
    beforeMove: function(ctxt) {
		// the spinner will have already saved the value
        ctxt.success();
    }
});
promptTypes.date = promptTypes.datetime.extend({
    type: "date",
    scrollerAttributes: {
        preset: 'date',
        theme: 'jqm',
		display: 'modal'
    }
});
promptTypes.time = promptTypes.datetime.extend({
    type: "time",
    scrollerAttributes: {
        preset: 'time',
        theme: 'jqm',
		display: 'modal'
    },
    modification: function(evt) {
		var that = this;
        var value = that.$('input').scroller('getDate');
		var ref = that.getValue();
		var rerender = ((ref == null || value == null) && (ref != value )) ||
				(ref != null && value != null && ref.valueOf() != value.valueOf());
		var ctxt = controller.newContext(evt);
        ctxt.append("prompts." + that.type + ".modification", "px: " + that.promptIdx);
        var renderContext = that.renderContext;
		if ( value == null ) {
			renderContext.value = '';
		} else {
			renderContext.value = that.$('input').val();
		}
        that.setValue($.extend({}, ctxt, {
            success: function() {
                renderContext.invalid = !that.validateValue();
				if ( rerender ) {
					that.debouncedRender();
				}
                ctxt.success();
            },
            failure: function(m) {
                renderContext.invalid = true;
				if ( rerender ) {
					that.debouncedRender();
				}
                ctxt.failure(m);
            }
        }), value);
    },
    //TODO: This will have problems with image labels.
    render: function() {
        var that = this;
        that.$el.html(that.template(that.renderContext));
        //Triggering create seems to prevent some issues where jQm styles are not applied.
        that.$el.trigger('create');
		that.$('input').scroller(that.scrollerAttributes);
		var value = that.getValue();
		if ( value == null ) {
			that.$('input').val
			that.$('input').scroller('setDate',new Date(),false);
		} else {
			that.$('input').scroller('setDate',value, true);
		}
        return this;
    },
    beforeMove: function(ctxt) {
		// the spinner will have already saved the value
        ctxt.success();
    }
});
/**
 * Media is an abstract object used as a base for image/audio/video
 */
promptTypes.media = promptTypes.base.extend({
    type: "media",
    captureAction: null, // overridden by derived classes -- the intent to fire
    chooseAction: null, // overridden by derived classes -- the intent to fire
    events: {
        "click .captureAction:enabled": "capture",
        "click .chooseAction:enabled": "choose"
    },
    disableButtons: function() {
        var that = this;
        that.$('.captureAction').attr('disabled','true');
        that.$('.chooseAction').attr('disabled','true');
    },
    enableButtons: function() {
        var that = this;
        that.$('.captureAction').removeAttr('disabled');
        that.$('.chooseAction').removeAttr('disabled');
    },
    capture: function(evt) {
        var that = this;
        var ctxt = controller.newContext(evt);
        that.disableButtons();
        var platInfo = opendatakit.getPlatformInfo(ctxt);
        // TODO: is this the right sequence?
        var outcome = collect.doAction('' + that.promptIdx, 'take' + that.type, that.captureAction, null);
        ctxt.append('media.capture', platInfo.container + " outcome is " + outcome);
        if (outcome === null || outcome !== "OK") {
            alert("Should be OK got >" + outcome + "<");
            that.enableButtons();
            ctxt.failure({message: "Action canceled."});
        } else {
            ctxt.success();
        }
    },
    choose: function(evt) {
        var that = this;
        var ctxt = controller.newContext(evt);
        that.disableButtons();
        var platInfo = opendatakit.getPlatformInfo(ctxt);
        // TODO: is this the right sequence?
        var outcome = collect.doAction('' + that.promptIdx, 'take' + that.type, that.chooseAction, null);
        ctxt.append('media.capture', platInfo.container + " outcome is " + outcome);
        if (outcome === null || outcome !== "OK") {
            alert("Should be OK got >" + outcome + "<");
            that.enableButtons();
            ctxt.failure({message: "Action canceled."});
        } else {
            ctxt.success();
        }
    },
    getCallback: function(ctxt, bypath, byaction) {
        var that = this;
        return function(ctxt, path, action, jsonString) {
            ctxt.append("prompts." + that.type + 'getCallback.actionFn', "px: " + that.promptIdx + " action: " + action);
            var jsonObject = JSON.parse(jsonString);
            if (jsonObject.status == -1 /* Activity.RESULT_OK */ ) {
                ctxt.append("prompts." + that.type + 'getCallback.actionFn.resultOK', "px: " + that.promptIdx + " action: " + action);
                var uri = (jsonObject.result != null) ? jsonObject.result.uri : null;
				var contentType = (jsonObject.result != null) ? jsonObject.result.contentType : null;
                if (uri != null && contentType != null) {
                    // TODO: write as MIMEURI type
                    var oldPath = that.getValue();
                    if ( uri != oldPath) {
                        // TODO: delete old??? Or leave until marked as finalized?
                        // TODO: I'm not sure how the resuming works, but we'll need to make sure
                        // onActivate get's called AFTER this happens.
                        database.setData( $.extend({},ctxt,{success:function() {
                                that.enableButtons();
                                var mediaUri = that.getValue();
								var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
                                that.renderContext.mediaPath = uri;
                                that.renderContext.uriValue = uri;
                                that.render();
                                ctxt.success();
                            },
                            failure:function(m) {
                                that.enableButtons();
                                var mediaUri = that.getValue();
								var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
                                that.renderContext.mediaPath = uri;
                                that.renderContext.uriValue = uri;
                                that.render();
                                ctxt.failure(m);
                            }}), that.name, { uri : uri, contentType: contentType } );
                    }
                }
            }
            else {
                ctxt.append("prompts." + that.type + 'getCallback.actionFn.failureOutcome', "px: " + that.promptIdx + " action: " + action);
                console.log("failure returned");
                alert(jsonObject.result);
                that.enableButtons();
                var mediaUri = that.getValue();
                var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
                that.renderContext.mediaPath = uri;
                that.renderContext.uriValue = uri;
                that.render();
                ctxt.failure({message: "Action canceled."});
            }
        };
    }
});
promptTypes.image = promptTypes.media.extend({
    type: "image",
	contentType: "image/*",
    label: 'Take your photo:',
    templatePath: "templates/image.handlebars",
    captureAction: 'org.opendatakit.collect.android.activities.MediaCaptureImageActivity',
    chooseAction: 'org.opendatakit.collect.android.activities.MediaChooseImageActivity',
    onActivate: function(ctxt) {
        var that = this;
        var mediaUri = that.getValue();
        var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
		that.renderContext.mediaPath = uri;
		that.renderContext.uriValue = uri;
        this.baseActivate(ctxt);
    }
});
promptTypes.video = promptTypes.media.extend({
    type: "video",
	contentType: "video/*",
    label: 'Take your video:',
    templatePath: "templates/video.handlebars",
    captureAction: 'org.opendatakit.collect.android.activities.MediaCaptureVideoActivity',
    chooseAction: 'org.opendatakit.collect.android.activities.MediaChooseVideoActivity',
    onActivate: function(ctxt) {
        var that = this;
        var mediaUri = that.getValue();
        var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
		that.renderContext.mediaPath = uri;
		that.renderContext.uriValue = uri;
		that.renderContext.videoPoster = uri;
        this.baseActivate(ctxt);
    }
});
promptTypes.audio = promptTypes.media.extend({
    type: "audio",
	contentType: "audio/*",
    templatePath: "templates/audio.handlebars",
    captureAction: 'org.opendatakit.collect.android.activities.MediaCaptureAudioActivity',
    chooseAction: 'org.opendatakit.collect.android.activities.MediaChooseAudioActivity',
    label: 'Take your audio:',
    onActivate: function(ctxt) {
        var that = this;
        var mediaUri = that.getValue();
        var uri = (mediaUri != null && mediaUri.uri != null) ? mediaUri.uri : null;
		that.renderContext.mediaPath = uri;
		that.renderContext.uriValue = uri;
        this.baseActivate(ctxt);
    },
});
/**
 * launch_intent is an abstract prompt type used as a base for single intent launching (e.g. barcodes)
 * Ideally just the templates and intentStrings will need to be customized.
 */
promptTypes.launch_intent = promptTypes.base.extend({
    type: "launch_intent",
    buttonLabel: 'Launch intent',
    templatePath: "templates/launch_intent.handlebars",
    intentString: "",
    intentParameters: null,//TODO: Allow this arguement to be an object {},
    events: {
        "click .launch": "launch"
    },
    onActivate: function(ctxt) {
        var that = this;
        var value = that.getValue();
        that.renderContext.value = value;
        that.renderContext.buttonLabel = that.buttonLabel;
        this.baseActivate(ctxt);
    },
    launch: function(evt) {
        var ctxt = controller.newContext(evt);
        var platInfo = opendatakit.getPlatformInfo(ctxt);
        $('#block-ui').show().on('swipeleft swiperight click', function(evt) {
            evt.stopPropagation();
        });
        //We assume that the webkit could go away when an intent is launched,
        //so this prompt's "address" is passed along with the intent.
        var outcome = collect.doAction('' + this.promptIdx, this.name, this.intentString, this.intentParameters);
        ctxt.append(this.intentString, platInfo.container + " outcome is " + outcome);
        if (outcome && outcome === "OK") {
            ctxt.success();
        } else {
            alert("Should be OK got >" + outcome + "<");
            $('#block-ui').hide().off();
            ctxt.failure({message: "Action canceled."});
        }
        //Removing this because I want to simulate intents
        //when not on android.
    },
    /**
     * When the intent returns a result this factory function creates a callback to process it.
     * The callback can't use any state set before the intent was launched because the page might have been reloaded.
     */
    getCallback: function(ctxt, bypath, byaction) {
        var that = this;
        $('#block-ui').hide().off();
        return function(ctxt, path, action, jsonString) {
            var jsonObject;
            ctxt.append("prompts." + that.type + 'getCallback.actionFn', "px: " + that.promptIdx + " action: " + action);
            try {
                jsonObject = JSON.parse(jsonString);
            } catch (e) {
                alert("Could not parse: " + jsonString);
            }
            if (jsonObject.status == -1 ) { // Activity.RESULT_OK
                ctxt.append("prompts." + that.type + 'getCallback.actionFn.resultOK', "px: " + that.promptIdx + " action: " + action);
                if (jsonObject.result != null) {
                    that.setValue($.extend({}, ctxt, {
                        success: function() {
                            that.renderContext.value = that.getValue();
                            that.render();
                            ctxt.success();
                        }
                    }), that.extractDataValue(jsonObject));
                }
            } else {
                ctxt.append("prompts." + that.type + 'getCallback.actionFn.failureOutcome', "px: " + that.promptIdx + " action: " + action);
                alert("failure returned");
                console.error(jsonObject);
                ctxt.failure({message: "Action canceled."});
            }
        };
    },
	extractDataValue: function(jsonObject) {
		return jsonObject.result;
	}
});
/* Save only SCAN_RESULT ? */
promptTypes.barcode = promptTypes.launch_intent.extend({
    type: "barcode",
    intentString: 'com.google.zxing.client.android.SCAN',
 	extractDataValue: function(jsonObject) {
		return jsonObject.result.value;
	}
});
promptTypes.geopoint = promptTypes.launch_intent.extend({
    type: "geopoint",
    intentString: 'org.opendatakit.collect.android.activities.GeoPointActivity',
 	extractDataValue: function(jsonObject) {
		return { latitude: jsonObject.result.latitude, 
				 longitude: jsonObject.result.longitude, 
				 altitude: jsonObject.result.altitude, 
				 accuracy: jsonObject.result.accuracy };
	}
});
promptTypes.geopointmap = promptTypes.launch_intent.extend({
    type: "geopointmap",
    intentString: 'org.opendatakit.collect.android.activities.GeoPointMapActivity',
 	extractDataValue: function(jsonObject) {
		return { latitude: jsonObject.result.latitude, 
				 longitude: jsonObject.result.longitude, 
				 altitude: jsonObject.result.altitude, 
				 accuracy: jsonObject.result.accuracy };
	}
});
/*
//HTML5 geopoints seem to work in the browser but not in the app.
promptTypes.geopoint = promptTypes.input_type.extend({
    type: "geopoint",
    label: 'Capture geopoint:',
    templatePath: "templates/geopoint.handlebars",
    events: {
        "click .captureAction": "capture"
    },
    capture: function(evt){
        var that = this;
        that.$('.status').text("Capturing...");
        that.$('.captureAction').addClass('ui-disabled');
        function success(position) {
            that.setValue($.extend({}, controller.newContext(evt), {
                success: function() {
                    that.renderContext.value = position;
                    that.render();
                }
            }), position);
        }
        function error(msg) {
            that.$('.status').text((typeof msg == 'string') ? msg : "failed");
            console.log(arguments);
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success, error, {
                "enableHighAccuracy": true
            });
        } else {
            error('not supported');
        }
    },
    onActivate: function(ctxt) {
        var that = this;
        var value = that.getValue();
        that.renderContext.value = value;
        this.baseActivate(ctxt);
    }
});
*/
promptTypes.screen = promptTypes.base.extend({
    type: "screen",
    prompts: [],
    initialize: function() {
        var that = this;
        this.prompts = builder.initializePrompts(this.prompts, function(){});
        //Wire up the prompts so that if any of them rerender the screen rerenders.
        //TODO: Think about whether there is a better way of doing this.
        //Maybe bind this or subprompts to database change events instead?
        _.each(this.prompts, function(prompt){
            prompt._screenRender = prompt.render;
            prompt.render = function(){
                that.render();
            };
        });
        //this.initializeTemplate();
        this.initializeRenderContext();
        this.afterInitialize();
    },
    isInitializeComplete: function() {
        var i;
        for ( i = 0 ; i < this.prompts.length; ++i ) {
            var p = this.prompts[i];
            if ( !p.isInitializeComplete() ) return false;
        }
        return true;
    },
    getActivePrompts: function(context) {
        var that = this;
        var subPrompts;
        subPrompts = _.filter(that.prompts, function(prompt) {
            try {
                if('condition' in prompt) {
                    return prompt.condition();
                }
            } catch (e) {
                if ( context ) {
                    context.append('prompts.screen.getActivePrompts.condition.exception', e);
                } else {
                    console.error('prompts.screen.getActivePrompts.condition.exception: ' + e);
                }
                return false;
            }
            return true;
        });
        return subPrompts;
    },
    beforeMove: function(context) {
        var that = this;
        var subPrompts, subPromptContext;
        subPrompts = that.getActivePrompts(context);
        subPromptContext = $.extend({},context,{
            success: _.after(subPrompts.length, context.success),
            failure: _.once(context.failure)
        });
        $.each(subPrompts, function(idx, prompt){
            prompt.beforeMove(subPromptContext);
        });
    },
    validate: function(context) {
        var that = this;
        var subPrompts, subPromptContext;
        subPrompts = that.getActivePrompts(context);
        subPromptContext = $.extend({},context,{
            success: _.after(subPrompts.length, context.success),
            failure: _.once(context.failure)
        });
        $.each(subPrompts, function(idx, prompt){
            prompt.validate(subPromptContext);
        });
    },
    onActivate: function(ctxt) {
        var that = this;
        var subPromptsReady = _.after(this.prompts.length, function () {
            that.baseActivate(ctxt);
        });
        _.each(this.prompts, function(prompt){
            prompt.onActivate($.extend({}, ctxt, {
                success:function() {
                    subPromptsReady(ctxt);
                }
            }));
        });
    },
    render: function() {
        var that = this;
        var subPrompts = that.getActivePrompts();
        this.$el.html('<div class="odk odk-prompts">');
        var $prompts = this.$('.odk-prompts');
        $.each(subPrompts, function(idx, prompt){
            //prompt.render();
            prompt._screenRender();
            if(!prompt.$el){
                alert("Sub-prompt has not been rendered. See console for details.");
                console.error("Prompts must have synchronous render functions. Don't debounce them or launch async calls before el is set.");
                console.error(prompt);
            }
            $prompts.append(prompt.$el);
            prompt.delegateEvents();
        });
        this.$el.trigger('create');
        this.afterRender();
        return this;
    },
    whenTemplateIsReady: function(ctxt){
        //This stub is here because screens have no template so the default 
        //whenTemplateIsReady would otherwise cause an error in baseActivate.
		ctxt.success();
    }
});
promptTypes.label = promptTypes.base.extend({
    type: "label",
    hideInHierarchy: true,
    isInitializeComplete: function() {
        return true;
    },
    onActivate: function(ctxt){
        alert("label.onActivate: Should never be called!");
        ctxt.failure({message: "Internal error."});
    }
});
promptTypes.goto = promptTypes.base.extend({
    type: "goto",
    hideInHierarchy: true,
    isInitializeComplete: function() {
        return true;
    },
    onActivate: function(ctxt) {
        alert("goto.onActivate: Should never be called!");
        ctxt.failure({message: "Internal error."});
    }
});
promptTypes.note = promptTypes.base.extend({
    type: "note",
    hideInHierarchy: true,
    templatePath: "templates/note.handlebars"
});
promptTypes.acknowledge = promptTypes.select.extend({
    type: "acknowledge",
    autoAdvance: false,
    acknLabel: translations.acknLabel,
    modification: function(evt) {
        var ctxt = controller.newContext(evt);
        ctxt.append('acknowledge.modification', this.promptIdx);
        var that = this;
        var acknowledged = this.$('#acknowledge').is(':checked');
        this.setValue($.extend({}, ctxt, {
            success: function() {
                that.renderContext.choices = [{
                    "name": "acknowledge",
                    "label": that.acknLabel,
                    "checked": acknowledged
                }];
                if (acknowledged && that.autoAdvance) {
                    controller.gotoNextScreen(ctxt);
                }
                else {
                    ctxt.success();
                }
            }
        }), acknowledged);
    },
    onActivate: function(ctxt) {
        var that = this;
        var acknowledged;
        try{
            acknowledged = JSON.parse(that.getValue());
        } catch(e) {
            acknowledged = false;
        }
        that.renderContext.choices = [{
            "name": "acknowledge",
            "label": that.acknLabel,
            "checked": acknowledged
        }];
        this.baseActivate(ctxt);
    }
});
promptTypes.with_next = promptTypes.base.extend({
    type: "with_next",
    hideInHierarchy: true,
    assignToValue: function(ctxt){
        var that = this;
        var value;
        try {
            value = that.assign();
        } catch (e) {
            ctxt.append('prompts.'+that.type+'.assignToValue.assign.exception', e);
            ctxt.failure({message: "Error computing with_next expression."});
            return;
        }
        that.setValue(ctxt, value);
    }
});
promptTypes.error = promptTypes.base;

//Ensure all prompt type names are lowercase.
//TODO: Move to a test suite.
_.each(_.keys(promptTypes), function(promptTypeName){
    if(promptTypeName !== promptTypeName.toLowerCase()) {
        alert("Invalid prompt type name: " + promptTypeName);
    }
});

});