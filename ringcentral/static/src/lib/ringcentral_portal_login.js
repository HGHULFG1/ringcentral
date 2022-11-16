odoo.define('ringcentral.ringcentral_login', function(require) {

    var ListRenderer = require('web.ListRenderer');
    var ListController = require('web.ListController');
    var ListView = require('web.ListView');
    var rpc = require('web.rpc');

    var QuickLineControllerMixin = {

        _load_login_button: function() {
            var self = this;
            if (!this.$buttons) {
                return;
            }
            this.$buttons.on('click', '.oe_ringcentral_login', function() {
                rpc.query({
                    model : 'crm.phonecall',
                    method: 'get_service_uri',
                    args:[]
                }).then(function(result){
                    var url = result.split("/login/")
                    window.open(url[0]);
                    // alert("Login successfully!")
                })
                // self.searchView.do_search()
            });
            this.$buttons.on('click', '.oe_ringcentral_sync', function() {
                self.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'ringcentral.sync',
                    views: [[false, 'form']],
                    target: 'new'
                })
            })
            this.$buttons.on('click', '.oe_ringcentral_sync_agents', function() {
                rpc.query({
                    model : 'crm.phonecall',
                    method: 'fetch_agents',
                    args: []
                }).then(function(result){
                    console.log("=============")
                })
            })
        }
    }
    ListController.include({
        init: function() {
            var self = this;
            this._super.apply(this, arguments);
        },
        renderButtons: function() {
            var self = this;
            this._super.apply(this, arguments); // Sets this.$buttons
            $('.oe_account_select_journal').val('')
            QuickLineControllerMixin._load_login_button.call(this);
        },
    });
});
