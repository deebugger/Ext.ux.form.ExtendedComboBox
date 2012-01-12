/**
 * Ext.ux.form.ExtendedComboBox - an extended combo-box
 * which supports multi-selection and search capabilities
 * 
 * xtype: 'extendedComboBox'
 * 
 * @author: Dror Ben-Gai (deebug.dev@gmail.com)
 * @date: August, 2011
 */

// add RegExp.escape if it has not been already added
if('function' !== typeof RegExp.escape) {
    RegExp.escape = function(s) {
        if('string' !== typeof s) {
            return s;
        }
        // Note: if pasting from forum, precede ]/\ with backslash manually
        return s.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
    }; // eo function escape
}

Ext.namespace('Ext.ux.form');

/////////////////////
// internal constants
// !! don't change those or all hell will break loose !!
var CHECKED_NONE = 0;
var CHECKED_SOME = 1;
var CHECKED_ALL = 2;
    
Ext.ux.form.ExtendedComboBox = Ext.extend(Ext.form.ComboBox, {
    ////////////////////
    // combobox defaults
    triggerAction: 'all',

    /////////////////////
    // special attributes

    // single- or multi-select mode
    singleSelect: true,

    // (multi-select) show the 'select all/none' button
    // also control whether to show the allSelectionText (see below) text of all value
    showSelectAll: true,

    // (multi-select) text to be shown when all items have been selected
    // use '' (empty string) to always show the list of values
    // list of values will always be shown when showSelectAll (see above) is false
    allSelectionText: '(' + Messages.get('casi.frontend.general.label.showAll') + ')',

    // (multi-select) select all values upon store.load complete
    selectAllOnLoad: false,

    // (multi-select) show the search box
    showSearch: true,

    // (multi-select) the limit of items that can be selected
    limitSelection: 0,

    // (multi-select) a unique name for an added field in the store to mark selected items
    checkField: 'ExtendedComboBox_checked',

    // (multi-select) separator between multiple selected items in the combobox value
    separator: ',',

    // (multil-select) only show the select all / search toolbar is there are more than X items
    minItemCountForBbar: 0,

    // default max character length
    maxCharLength: 100,

    //////////////////////
    // internal attributes

    // keep the combo from collapsing (internal)
    keepExpanded: false,
    
    /**
     * initComponent: initialize the component (duh!)
     * but seriously, this is where the template for multi-select is defined,
     * as well as other settings like the bottom toolbar which can contain
     * the 'select all/none' button and the search box
     */
    initComponent: function() {
        if(this.singleSelect) {
            // single-select
            return;
        }
        
        // multi-select
        this.editable = false;
        this.forceSelection = true;
        
        if(!this.tpl) {
            this.tpl = '<tpl   for=".">'
            +'<div class="x-combo-list-item">'
            +'<img src="' + Ext.BLANK_IMAGE_URL + '" '
            +'class="ux-extcombo-icon ux-extcombo-icon-'
            +'{[values.' + this.checkField + '?"checked":"unchecked"' + ']}">'
            +'<div class="ux-extcombo-item-text">{' + (this.displayField || 'text' ) + ':substr(0,'+ (this.maxCharLength) + ')}</div>'
            +'</div>'
            +'</tpl>';
        }

        var me = this;
        this.on({
            expand: function(comp) {
                // display full list
                me.doQuery(me.allQuery);

                // only paint the bottom toolbar if:
                // - it wasn't painted before AND
                // - this.list exists AND
                // - the store contains more than this.minItemCountForBbar AND
                //   - this.showSearch is true
                //     OR
                //   - this.showSelectAll is true
                if(!me.extendedPageTb &&
                        me.list &&
                        me.store.getCount() > me.minItemCountForBbar &&
                        ((me.showSelectAll) || me.showSearch)) {
                    var cls = 'x-combo-list';
                    me.footer = me.list.createChild({
                        cls: cls + '-ft'
                    });
                    me.extendedPageTb = new Ext.Toolbar({
                        renderTo: me.footer,
                        items: [
                        {
                            id: 'multiSelectPopupSelections_' + me.id,
                            xtype: 'splitbutton',
                            iconCls: '', // will be set in afterrender handler
                            hidden: !me.showSelectAll,
                            handler: function() {
                                // if something is selected, then select none,
                                // else select all
                                if(me.getCheckState(true) != CHECKED_ALL) {
                                    me.selectAll();
                                } else {
                                    me.selectNone();
                                }
                                me.updateSelectAllIcon(true);
                            },
                            listeners: {
                                afterrender: function(comp) {
                                    // set the button's icon
                                    me.updateSelectAllIcon();
                                },
                                menushow: function() {
                                    // if the menu is shown, keep the combo box from collapsing
                                    me.keepExpanded = true;
                                },
                                menuhide: function() {
                                    // if the menu is shown, keep the combo box from collapsing
                                    me.keepExpanded = false;
                                }
                            },
                            menu: [
                                {
                                    id: 'multiSelectPopupSelections_' + me.id + '_all',
                                    text: me.limitSelection <= 0 ? 
                                        Messages.get('casi.frontend.extcombo.selectAll') :
                                        Messages.get('casi.frontend.extcombo.selectAllLimit', {limit:me.limitSelection}),
                                    iconCls: 'checkboxCheckedIcon',
                                    handler: function() {
                                        me.selectAll();
                                        me.updateSelectAllIcon(true);
                                    }
                                },
                                {
                                    id: 'multiSelectPopupSelections_' + me.id + '_none',
                                    text: Messages.get('casi.frontend.extcombo.selectNone'),
                                    iconCls: 'checkboxUncheckedIcon',
                                    handler: function() {
                                        me.selectNone();
                                        me.updateSelectAllIcon(true);
                                    }
                                }
                            ]
                        },
                        '->',
                        {
                            id: 'multiSelectPopupSearch_' + me.id,
                            hidden: !me.showSearch,
                            xtype: 'ux-searchbox',
                            searchFunction: function(value) {
                                me.store.filter('name', value, true, false);
                                me.updateSelectAllIcon(true);
                            },
                            clearFunction: function() {
                                me.store.filter('name', '');
                                me.updateSelectAllIcon(true);
                            }
                        }
                        ]
                    });
                    me.assetHeight += me.footer.getHeight();
                } else {
                    this.showSearch = false;
                }
            },
            collapse: function() {
                if(me.keepExpanded) {
                    me.keepExpanded = false;
                    // need to keep the combo expanded
                    // keep the search box value and set it to its former value after re-expanding
                    var filterValue = Ext.getCmp('multiSelectPopupSearch_' + me.id).getValue();
                    // clear the search box
                    Ext.getCmp('multiSelectPopupSearch_' + me.id).setSearchValue();
                    // re-expand the combo
                    me.expand();
                    // re-set the search box value
                    Ext.getCmp('multiSelectPopupSearch_' + me.id).setValue(filterValue);
                    me.store.filter('name', filterValue, true, false);
                    return;
                }
                if(me.showSearch) {
                    // clear the search box (== the store filter)
                    Ext.getCmp('multiSelectPopupSearch_' + me.id).setSearchValue();
                }
            }
        });

        var onStoreLoadFunction = function(store, records) {
            if(me.selectAllOnLoad) {
                // select all
                Ext.getCmp(me.id).selectAll();
            } else if(this.value != '') {
                // select the favourites
                this.setValue(this.value);
            }
        };

        this.store.on('load', onStoreLoadFunction.createDelegate(this));

        // in case the store is static, we can just call selectAll from here
        // (also, static stores don't call onLoad..)
        if(me.selectAllOnLoad) {
            Ext.getCmp(this.id).selectAll();
        }

        // call parent
        Ext.ux.form.ExtendedComboBox.superclass.initComponent.apply(this, arguments);
    },
    
    /**
     * assertValue: override of original function
     * for multi-select, don't try to assert the value since forceSelection is always true
     */
    assertValue: function() {
        if(this.singleSelect) {
            Ext.ux.form.ExtendedComboBox.superclass.assertValue.apply(this, arguments);
        }
    },

    /**
     * onSelect: behavior when user selects / de-selects an item
     */
    onSelect: function(record, index) {
        if(this.singleSelect) {
            Ext.ux.form.ExtendedComboBox.superclass.onSelect.apply(this, arguments);
        }

        // toggle checked field
        if(select_fav) {
            select_fav = false;
            // we need to repaint the checkbox, but this will only happen
            // if the value changes - so we change the value twice
            // to get it back to the original value
            // is this a hack? I don't thinks so..
            record.set(this.checkField, !record.get(this.checkField));
            record.set(this.checkField, !record.get(this.checkField));
        } else {
            // check limit
            if(!record.get(this.checkField)
                    && this.limitSelection > 0
                    && this.limitSelection < this.getCheckedNum(false) + 1) {
                message(Messages.get('casi.frontend.combo.limitReached', { limit: this.limitSelection}));
            } else {
                // we're under the limit - punch it!
                if(this.fireEvent('beforeselect', this, record, index) !== false){
                    record.set(this.checkField, !record.get(this.checkField));
                    this.setValue(this.getCheckedValue());
                    this.fireEvent('select', this, record, index);
                    this.updateSelectAllIcon();
                }
            }
        }
    },

    /**
     * setValue: set the value of the combobox, based on what is selected (none, some or all)
     */
    setValue: function(v) {
        if(v) {
            v = '' + v;
            if(this.valueField) {
                // If there is no data in the store, simply store the value, otherwise
                // process value and set it on the store records accordingly
                if (this.store.getTotalCount() > 0) {
                    this.store.each(function(r) {
                        var checked = !(!v.match(
                            '(^|' + this.separator + ')' + RegExp.escape(r.get(this.valueField))
                            +'(' + this.separator + '|$)'));
	
                        r.set(this.checkField, checked);
                    }, this);
                    this.value = this.getCheckedValue();
	
                    // If the combo is not visible there's no point on settings its html value (raw value)
                    // Once the combo will become visible again, it will be rendered according to
                    // this.value so we won't lose this value
                    if (this.isVisible()) {
                        this.setRawValue(this.getCheckedDisplay());
                    }
                    if(this.hiddenField) {
                        this.hiddenField.value = this.value;
                    }
                } else {
                    this.value = v;
                }
            } else {
                this.value = v;

                // If the combo is not visible there's no point on settings its html value (raw value)
                // Once the combo will become visible again, it will be rendered according to
                // this.value so we won't lose this value
                if (isVisible()) {
                    this.setRawValue(v);
                }
                if(this.hiddenField) {
                    this.hiddenField.value = v;
                }
            }
            if(this.el) {
                this.el.removeClass(this.emptyClass);
            }
        }
        else {
            this.clearValue();
        }
    },

    /**
     * getCheckedDisplay: arrange the data to be displayed as the value of the combobox
     */
    getCheckedDisplay: function() {
        if(this.getCheckedNum() == 0 && this.emptyText){
            return this.emptyText;
        }
        var re = new RegExp(this.separator, 'g');
        if(this.getCheckState() == CHECKED_ALL && this.showSelectAll == true && this.allSelectionText != '') {
            return this.allSelectionText;
        }
        var display = this.getCheckedValue(this.displayField).replace(re, this.separator + ' ');
        return display;
    },

    /**
     * getCheckedValue:
     */
    getCheckedValue:function(field) {
        field = field || this.valueField;
        var c = [];

        // store may be filtered so get all records
        var snapshot = this.store.snapshot || this.store.data;

        snapshot.each(function(r) {
            if(r.get(this.checkField)) {
                c.push(r.get(field));
            }
        }, this);

        return c.join(this.separator);
    },
    
    /**
     * selectAll: select all the filtered records
     * (records that are not currently shown will not be affected)
     */
    selectAll: function() {
        if(this.limitSelection > 0) {
            // there's a limit to how many items can be selected,
            // so stop selecting when we reach it
            this.store.each(function(record) {
                if(this.getCheckedNum(false) >= this.limitSelection) {
                    return;
                }
                record.set(this.checkField, true);
            }, this);
        } else {
            // select all the records - no limits
            this.store.each(function(record) {
                record.set(this.checkField, true);
            }, this);
        }
        
        this.setValue(this.getCheckedValue());
        this.validate();
    },
    
    /**
     * selectNone: de-select all the filtered records
     * (records that are not currently shown will not be affected)
     */
    selectNone: function() {
        this.store.each(function(r) {
            r.set(this.checkField, false);
        }, this);
        this.setValue(this.getCheckedValue());
        this.validate();
    },

    isAllSelected: function() {
        return this.getCheckState() == CHECKED_ALL && this.showSelectAll == true;
    },
    
    /**
     * getCheckedNum: get the number of selected items
     * - if param 'filtered' is true then only relate to the filtered items in the store
     */
    getCheckedNum: function(filtered) {
        var numChecked = 0;
        
        var localStore = filtered ? this.store :
            this.store.snapshot || this.store.data;
        
        localStore.each(function(record) {
            if(record.get(this.checkField)) {
                numChecked++;
            }
        }, this);
        
        return numChecked;
    },
    
    /**
     * getCheckState: return the state of the store, selection-wise
     * - if param 'filtered' is true then only relate to the filtered items in the store
     */
    getCheckState: function(filtered) {
        var numChecked = this.getCheckedNum(filtered);
        var localStore = filtered ? this.store :
            this.store.snapshot || this.store.data;
        return numChecked == 0 ? CHECKED_NONE : (numChecked == localStore.getCount() || numChecked == this.limitSelection) ? CHECKED_ALL : CHECKED_SOME;
    },
    
    /**
     * updateSelectAllIcon: update the 'select all' icon according to how much items are checked
     * - if param 'filtered' is true then only relate to the filtered items in the store
     */
    updateSelectAllIcon: function(filtered) {
        if(Ext.getCmp('multiSelectPopupSelections_' + this.id) == null) return;
        // checkState can be 0 (none checked), 1 (mix checked) or 2 (all checked)
        var checkState = this.getCheckState(filtered);
        if(checkState == CHECKED_NONE) {
            Ext.getCmp('multiSelectPopupSelections_' + this.id).setIconClass('checkboxUncheckedIcon');
        } else if(checkState == CHECKED_SOME) {
            Ext.getCmp('multiSelectPopupSelections_' + this.id).setIconClass('checkboxMixcheckedIcon');
        } else {
            Ext.getCmp('multiSelectPopupSelections_' + this.id).setIconClass('checkboxCheckedIcon');
        }
    }
});

Ext.reg('extendedComboBox', Ext.ux.form.ExtendedComboBox); 

