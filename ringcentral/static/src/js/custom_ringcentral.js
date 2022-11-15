odoo.define('ringcentral.ringcentralPanel', function(require) {
    "use strict";

    var Widget = require('web.Widget');
    var WebClient = require('web.WebClient');
    var config = require('web.config');
    var session = require('web.session');
    var rpc = require('web.rpc');
    var core = require('web.core');
    var ajax = require('web.ajax');
    var Dialog = require('web.Dialog');
    var utils = require('web.utils');
    // var FormData = require('form-data')


    //  for enterprise
    var dom = require('web.dom');

    var _t = core._t;
    var QWeb = core.qweb;

    var FormView = require('web.FormView');
    var basic_fields = require("web.basic_fields")
    $(".custom-combobox-input").keyup(function() {
       $(this).val($(this).val().replace(/\s/g, ""));
    })
    var PhoneCallFieldMixin = {
        _renderPhoneCallButton: function(readonly = false, phone_obj){
            var c_name = (readonly ? 'phone_readonly' : 'phone_edit');
            return $('<button>', {
                    type: 'button',
                    'class': c_name + ' fa fa-phone btn',
                })
                .on('click', this._onPhoneCall.bind(phone_obj));
            return $();
        },

        _onPhoneCall: function() {
            if (session.ringcentralPanel && this.value) {
                session.ringcentralPanel.makeCallForm(false, this.value);
            }
        },
    };

    basic_fields.FieldPhone.include({
        _renderReadonly: function() {
            this._super();
            this.$el = this.$el.add(PhoneCallFieldMixin._renderPhoneCallButton(true, this));
        },
        _renderEdit: function() {
            var def = this._super.apply(this, arguments);
            this.$el = this.$el.add(PhoneCallFieldMixin._renderPhoneCallButton(false, this));
            return def;
        },
    });
    FormView.include({
        load_record: function(record) {
            var self = this;
            var res = this._super(record);
            this.$el.find('.sync_ringcentral').off('click')
            this.$el.find('.sync_ringcentral').on('click', function() {

            })
            return res
        },
    });



    WebClient.include({
        start: function() {
            var self = this;

            // we add the o_touch_device css class to allow CSS to target touch
            // devices.  This is only for styling purpose, if you need javascript
            // specific behaviour for touch device, just use the config object
            // exported by web.config
            this.$el.toggleClass('o_touch_device', config.device.touch);
            this.on("change:title_part", this, this._title_changed);
            this._title_changed();
            var state = $.bbq.getState();
            // If not set on the url, retrieve cids from the local storage
            // of from the default company on the user
            var current_company_id = session.user_companies.current_company[0]
            if (!state.cids) {
                state.cids = utils.get_cookie('cids') !== null ? utils.get_cookie('cids') : String(current_company_id);
            }
            var stateCompanyIDS = _.map(state.cids.split(','), function(cid) {
                return parseInt(cid)
            });
            var userCompanyIDS = _.map(session.user_companies.allowed_companies, function(company) {
                return company[0]
            });
            // Check that the user has access to all the companies
            if (!_.isEmpty(_.difference(stateCompanyIDS, userCompanyIDS))) {
                state.cids = String(current_company_id);
                stateCompanyIDS = [current_company_id]
            }
            // Update the user context with this configuration
            session.user_context.allowed_company_ids = stateCompanyIDS;
            $.bbq.pushState(state);
            // Update favicon
            $("link[type='image/x-icon']").attr('href', '/web/image/res.company/' + String(stateCompanyIDS[0]) + '/favicon/')
            return session.is_bound
                .then(function() {
                    self.$el.toggleClass('o_rtl', _t.database.parameters.direction === "rtl");
                    self.bind_events();
                    return Promise.all([
                        self.set_action_manager(),
                        self.set_loading(),
                        self.set_ringcentral_sidebar()
                    ]);
                }).then(function() {
                    if (session.session_is_valid()) {
                        return self.show_application();
                    } else {
                        // database manager needs the webclient to keep going even
                        // though it has no valid session
                        return Promise.resolve();
                    }
                }).then(function() {
                    // Listen to 'scroll' event and propagate it on main bus
                    self.action_manager.$el.on('scroll', core.bus.trigger.bind(core.bus, 'scroll'));
                    core.bus.trigger('web_client_ready');
                    odoo.isReady = true;
                    if (session.uid === 1) {
                        self.$el.addClass('o_is_superuser');
                    }
                    self.$el.find('#ringcentral_menu').slidemenu();
                });

            core.bus.on('change_menu_section', this, function(menuID) {
                this.do_push_state(_.extend($.bbq.getState(), {
                    menu_id: menuID,
                }));
            });
        },
        

        show_application: function () {
        var self = this;
        this.set_title();

        return this.menu_dp.add(this.instanciate_menu_widgets()).then(function () {
            $(window).bind('hashchange', self.on_hashchange);

            // If the url's state is empty, we execute the user's home action if there is one (we
            // show the first app if not)
            var state = $.bbq.getState(true);
            if (_.keys(state).length === 1 && _.keys(state)[0] === "cids") {
                return self.menu_dp.add(self._rpc({
                        model: 'res.users',
                        method: 'read',
                        args: [session.uid, ["action_id"]],
                    }))
                    .then(function (result) {
                        var data = result[0];
                        if (data.action_id) {
                            return self.do_action(data.action_id[0]).then(function () {
                                self.menu.change_menu_section(self.menu.action_id_to_primary_menu_id(data.action_id[0]));
                            });
                        } 
                    });
            } else {
                return self.on_hashchange();
            }
        });
    },
        openFirstApp: function () {
            this._appsMenu.openFirstApp();
        },
        set_ringcentral_sidebar: function() {
            var self = this;
            session.user_has_group('ringcentral.ringcentral_user').then(function(is_ringcentral_user) {
                if (is_ringcentral_user) {
                    var base_view = $('.o_web_client')
                    self.ringcentralPanel = new ringcentralPanel(self);
                    self.ringcentralPanel.appendTo(base_view);
                    session.ringcentralPanel = self.ringcentralPanel
                }
            });
        },

        // Needs this method to have sidebar menu for Enterprise app switcher compatibility
        toggle_app_switcher: function(display) {
            if (display === this.app_switcher_displayed) {
                return; // nothing to do (prevents erasing previously detached webclient content)
            }
            if (display) {
                var self = this;
                this.clear_uncommitted_changes().then(function() {
                    // Save the current scroll position of the action_manager
                    self.action_manager.setScrollTop(self.getScrollTop());

                    // Detach the web_client contents
                    var $to_detach = self.$el.contents()
                        .not(self.menu.$el)
                        .not('.o_loading')
                        .not('.o_in_appswitcher')
                        .not('.o_notification_manager')
                        .not('.ringcentral_sidebar')
                        .not('.o_chat_window');
                    self.web_client_content = document.createDocumentFragment();
                    dom.detach([{
                        widget: self.action_manager
                    }], {
                        $to_detach: $to_detach
                    }).appendTo(self.web_client_content);

                    // Attach the app_switcher
                    self.append_app_switcher();
                    self.$el.addClass('o_app_switcher_background');

                    // Save and clear the url
                    self.url = $.bbq.getState();
                    self._ignore_hashchange = true;
                    $.bbq.pushState('#home', 2); // merge_mode 2 to replace the current state
                    self.menu.toggle_mode(true, self.action_manager.get_inner_action() !== null);
                });
            } else {
                dom.detach([{
                    widget: this.app_switcher
                }]);
                dom.append(this.$el, [this.web_client_content], {
                    in_DOM: true,
                    callbacks: [{
                        widget: this.action_manager
                    }],
                });
                this.app_switcher_displayed = false;
                this.$el.removeClass('o_app_switcher_background');
                this.menu.toggle_mode(false, this.action_manager.get_inner_action() !== null);
            }
        }
    });

    var ringcentralPanel = Widget.extend({
        'template': 'ringcentral.PhonecallWidget',
        init: function(parent) {
            this._super(parent);
            this.limit = 15;
            this.message_flag = false;
            this.a = 0;
            this.contacts = [];
            this.sdk = null;
            this.platform = null;
            this.webPhone = null;
            this.logLevel = 0;
            this.username = null;
            this.extension = null;
            this.appKey = null;
            this.rcsdk = null;
            this.sipInfo = null;
            this.loggedin = false;
            this.platform = null;
            this.phonecall_about_options = [];
            this.ringcentral_server = null;
            this.ringcentral_app_key = null;
            this.ringcentral_app_secret = null;
            this.ringcentral_redirect_uri = null;
            this.ringcentral_app_host = null;
            this.ringcentral_app_port = null;
            this.partner_search_string = '';
            this.contacts_partner = {};
            this.message_number = null;
            this.access_token = localStorage.getItem('access_token') || null;
            this.refresh_token = localStorage.getItem('refresh_token') || null;
            var nowDate = new Date();
            nowDate.setDate(nowDate.getDate() - 7);
            this.dateBefore2days = nowDate.getFullYear() + '-' + (nowDate.getMonth() + 1) + '-' + nowDate.getDate() + 'T00:00:00.000Z'
        },
        events: {
            'click li[data-target="#contacts"],.show_partners': 'render_contacts',
            'keyup #contact_search': 'contact_search',
            'click .dialpad': 'dialpad',
            'click .partner_details': 'show_partner_details',
            'click .outbound_call': 'makeCallForm',
            'click li[data-target="#call_log"]': 'load_callLog',
            'click li[data-target="#dialer"]': 'load_callLog_on_dialpad',
            'click li[data-target="#messages"], li[data-target="#compose_message"]': 'load_sent_messages',
            'click .send_msg': 'send_msg',
            'click .dial_call_contact_detail': 'dial_call_contact_detail',
            'click .send_message_contact_detail': 'send_message_contact_detail',
        },

        start: function() {
            var self = this;
            ajax.jsonRpc('/ringcentral_credentials', 'call', {
                'company_id': session.company_id,
                'uid': session.uid
            }).then(function(data) {
                if (data['ringcentral_server'] && data['ringcentral_app_key'] && data['ringcentral_app_secret'] && data['ringcentral_redirect_uri'] && data['ringcentral_app_host'] && data['ringcentral_app_port']) {
                    self.ringcentral_server = data['ringcentral_server'];
                    self.ringcentral_app_key = data['ringcentral_app_key'];
                    self.ringcentral_app_secret = data['ringcentral_app_secret'];
                    self.ringcentral_redirect_uri = data['ringcentral_redirect_uri'];
                    self.ringcentral_app_host = data['ringcentral_app_host'];
                    self.ringcentral_app_port = data['ringcentral_app_port'];
                    self.ringcentral_service_uri = data['ringcentral_service_uri'];
                    self.ringcentral_base_url = data['ringcentral_base_url'];
                    self.contacts_action = data['contacts_action'];
                    
                    
                    self.rcsdk = new RingCentral.SDK({
                        appKey: data['ringcentral_app_key'],
                        appSecret: data['ringcentral_app_secret'],
                        server: data['ringcentral_server']
                    });
                    self.platform = self.rcsdk.platform()
                    if (self.access_token) {
                        rpc.query({
                            model: 'res.users',
                            method: 'write',
                            args: [session.uid, {
                                'ringcentral_access_token': self.access_token
                            }]
                        })
                    }
                    if (self.access_token && self.platform._isAccessTokenValid()) {
                        $(self.$el).find('.fa-sign-in').addClass('d-none')
                        $(self.$el).find('.fa-sign-out').removeClass('d-none')
                        $(self.$el).find(".menu_sign_in_out_li").attr('title', 'Sign Out')
                        $(self.$el).find(".menu_sign_in_out_li").siblings().show();
                        $(self.$el).find('.menu-panels').css('display', 'block');
                        self.login(data['ringcentral_server'], data['ringcentral_app_key'], data['ringcentral_app_secret'], data['ringcentral_redirect_uri'], data['ringcentral_app_host'], data['ringcentral_app_port']);
                    } else {
                        $(self.$el).find('.fa-sign-in').removeClass('d-none')
                        $(self.$el).find('.fa-sign-out').addClass('d-none')
                        $(self.$el).find(".menu_sign_in_out_li").attr('title', 'Sign In')
                        $(self.$el).find(".menu_sign_in_out_li").siblings().hide();
                        $(self.$el).find('.menu-panels').css('display', 'none');
                    }
                    $(self.$el).find(".menu_sign_in_out_li").on('click', function() {
                        if ($(this).find('.fa-sign-in').hasClass('d-none')) {
                            $(this).find('.fa-sign-out').addClass('d-none')
                            $(this).find('.fa-sign-in').removeClass('d-none')
                            $(this).attr('title', 'Sign In')
                            $(self.$el).find(".menu_sign_in_out_li").siblings().hide();
                            $(self.$el).find('.menu-panels').css('display', 'none');
                            self.platform.logout()
                        } else {
                            if (self.access_token && self.platform._isAccessTokenValid()) {
                                self.login(data['ringcentral_server'], data['ringcentral_app_key'], data['ringcentral_app_secret'], data['ringcentral_redirect_uri'], data['ringcentral_app_host'], data['ringcentral_app_port']);
                            } else {
                                self.open_auth_window(data['ringcentral_server'], data['ringcentral_app_key'], data['ringcentral_app_secret'], data['ringcentral_redirect_uri'], data['ringcentral_app_host'], data['ringcentral_app_port'])
                            }
                        }
                    });
                }
            })

            rpc.query({
                model: 'crm.phonecall.about',
                method: 'search_read',
                args: [
                    [],
                    ["name"]
                ],
            }).then(function(phonecall_about_records) {
                self.phonecall_about_options = phonecall_about_records
            });

            return rpc.query({
                    model: 'res.partner',
                    method: 'get_search_read',
                    args: [],
                    context: session.context
                })
                .then(function(partner_ids) {
                    var partner_ids_li = []
                    var select = self.$el.find('#dialer,#compose_message').find(".combobox");
                    $('option', select).remove();
                    var option = new Option('Please enter Name or Number', '');
                    select.append($(option));
                    _.each(partner_ids, function(partner){
                        partner = {
                            "id": partner[0],
                            "name" : partner[1],
                            'phone' : partner[2],
                            "mobile" : partner[3]
                        }
                        partner_ids_li.push(partner)
                        if (partner.phone) {
                                option = new Option(partner.name + ' <' + partner.phone + '>', partner.phone);
                            } else {
                                option = new Option(partner.name + ' <' + partner.mobile + '>', partner.mobile);
                            }
                            select.append($(option));
                            self.contacts_partner[partner.id] = partner;
                            self.partner_search_string += self._partner_search_string(partner);
                        })

                self.contacts = partner_ids_li;
                }).then(function() {
                    var dialer_combobox = self.$el.find('#dialer,#compose_message').find(".combobox");
                    dialer_combobox.combobox();
                    dialer_combobox.parent().find('.custom-combobox input').attr('placeholder', 'Enter Name or Number');
                })

        },
        _partner_search_string: function(partner) {
            var str = partner.name;
            if (partner.phone) {
                str += '|' + partner.phone.split(' ').join('');
            }
            str = '' + partner.id + ':' + str.replace(':', '') + '\n';
            return str;
        },
        render_contacts: function() {
            var self = this
            self.platform.get('/restapi/v1.0/account/~/extension/~/address-book/contact').then(function(account_details) {
                var account_json = account_details.json();
                rpc.query({
                    model: 'res.partner',
                    method: 'ac_search_read',
                    args: [account_json['records']],
                    context: session.context
                })
            })
            var partners = []
            for (var i = 0, len = Math.min(this.contacts.length, this.limit); i < len; i++) {
                partners.push(this.contacts[i])
            }
            this.$el.find('#contacts').html(QWeb.render('ringcentral.contacts.search'))
            this.$el.find('#contacts').append(QWeb.render('ringcentral.contacts', {
                'partners': partners
            }))
        },
        contact_search: function() {
            var self = this;
            var partners = []
            var query = self.$el.find('#contact_search').val()
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(/ /g, '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.partner_search_string);
                if (r) {
                    var id = Number(r[1]);
                    partners.push(this.contacts_partner[id]);
                } else {
                    break;
                }
            }
            this.$el.find('#show_contacts').remove();
            this.$el.find('#contacts').append(QWeb.render('ringcentral.contacts', {
                'partners': partners
            }))
        },
        filter_number: function(phone_number) {
            if (phone_number.indexOf('<') > -1) {
                var start_pos = phone_number.indexOf('<') + 1;
                var pnumber = phone_number.substring(start_pos, phone_number.indexOf('>', start_pos)) 
                var ph = pnumber.replace(/\s/g,'');
                return ph
            } else {
                var pn = phone_number.replace(/\s/g,'');
                return pn
            }
        },
        send_msg: function() {
            var self = this;
            if (!self.platform._isAccessTokenValid()) {
                self.refresh_token_request()
            }
            var msg_text = self.$el.find('#msg_text').val();
            var msg_to = self.$el.find('#compose_message').find('.custom-combobox-input').val();
            if (!self.message_number){
                self.message_number = self.username
            }

            var body = {
                from: {
                    phoneNumber: self.message_number
                },
                to: [{
                    phoneNumber: self.filter_number(msg_to)
                }],
                text: msg_text
            }
            var formData = new FormData()
            formData.append('json', new File([JSON.stringify(body)], 'request.json', {
                type: 'application/json'
            }))
            var image_file = self.$el.find('#msg_image')
            var values_list = []
            if (image_file[0].files.length > 0) {
                _.each(image_file[0].files, function(image) {
                    formData.append('attachment', image)
                    var reader = new FileReader();
                    reader.onload = function() {
                        var result = reader.result
                        var data64 = result.split(',')[1];
                        var values = {
                            'name': image.name,
                            'type': 'binary',
                            'datas': data64,
                        };
                        values_list.push([0, 0, values]);
                    }
                    reader.readAsDataURL(image_file[0].files[0]);
                })
            }
            if (self.loggedin) {
                if (msg_to) {
                    self.platform.post('/account/~/extension/~/sms', formData)
                        .then(function(response) {
                            rpc.query({
                                model: 'crm.phonecall',
                                method: 'create',
                                args: [{
                                    'name': self.username,
                                    'type': 'sent',
                                    'partner_phone': self.filter_number(msg_to),
                                    'date': new moment(),
                                    'description': msg_text,
                                    'attachment_ids': values_list,
                                    'ringcentral_message_id': response.json().id
                                }],
                            })
                            self.$el.find('#msg_text').val('');
                            self.$el.find('#msg_image').val('')
                            self.$el.find('#compose_message').find('.custom-combobox-input').val('');
                            alert('Success: ' + response.json().id);
                        })
                        .catch(function(e) {
                            alert('Error: ' + e.message);
                        });
                } else {
                    alert('Error: Please Enter Number.')
                }
            } else {
                alert('You are not logged in in RingCentral. Please contact your Administrator.')
            }
        },
        dialpad: function(e) {
            this.$el.find('#dialer').find('.custom-combobox-input').val(this.$el.find('#dialer').find('.custom-combobox-input').val() + $(e.currentTarget).data('number')).keypress()
        },
        send_message_contact_detail: function() {
            var self = this;
            //          self.$el.find('li[data-target="#compose_message"]').click();
            //          self.$el.find('.menu-panels #compose_message').addClass('active')
        },
        show_partner_details: function(e) {
            var self = this;
            this.$el.find('#contacts').show("slide", function() {
                self.$el.find('#contacts').html(QWeb.render('ringcentral.partner_call_details', {
                    'image_128': $(e.currentTarget).data('partner_image'),
                    'phone': $(e.currentTarget).data('partner_phone'),
                    'email': $(e.currentTarget).data('partner_email'),
                    'name': $(e.currentTarget).data('partner_name')
                }))
            }, {
                direction: "left"
            }, 1000)
        },
        //      refresh_token_request: function(){

        //      },
        open_auth_window: function(server, appKey, appSecret, redirectUri, appHost, appPost) {
            var self = this;
            var OAuthCode = function(rcsdk, config) {
                this.config = config;
                this.loginPopup = function() {
                    var authUri = self.rcsdk.platform().authUrl({
                        redirectUri: this.config['RC_APP_REDIRECT_URL']
                    })
                    this.loginPopupUri(authUri, this.config['RC_APP_REDIRECT_URL']);
                }
                this.loginPopupUri = function(authUri, redirectUri) {
                    var win = window.open(authUri, 'windowname1', 'width=800, height=600');
                    var pollOAuth = window.setInterval(function() {
                        try {
                            if (win.document) {
                                if (win.document.URL.indexOf('error') != -1) {
                                    window.clearInterval(pollOAuth);
                                    win.close();
                                } else {
                                    if (win.document.URL.indexOf(redirectUri) != -1) {
                                        window.clearInterval(pollOAuth);
                                        var qs = self.rcsdk.platform().parseAuthRedirectUrl(win.document.URL);
                                        qs.redirectUri = redirectUri;
                                        win.close();
                                        if ('code' in qs) {
                                            self.platform.login(qs).then(function(response) {
                                                    var obj = JSON.parse(response.text());
                                                    self.loggedin = true;
                                                    localStorage.setItem("access_token", obj.access_token);
                                                    localStorage.setItem('refresh_token', obj.refresh_token)
                                                    self.access_token = obj.access_token;
                                                    self.refresh_token = obj.refresh_token;
                                                    $(self.$el).find('.fa-sign-in').addClass('d-none')
                                                    $(self.$el).find('.fa-sign-out').removeClass('d-none')
                                                    $(self.$el).find(".menu_sign_in_out_li").attr('title', 'Sign Out')
                                                    $(self.$el).find(".menu_sign_in_out_li").siblings().show();
                                                    $(self.$el).find('.menu-panels').css('display', 'block');
                                                    if (self.access_token) {
                                                        rpc.query({
                                                            model: 'res.users',
                                                            method: 'write',
                                                            args: [session.uid, {
                                                                'ringcentral_access_token': self.access_token
                                                            }]
                                                        })
                                                    }
                                                    return self.platform.get('/restapi/v1.0/account/~/extension/~');
                                                }).then(function(res) {
                                                    self.extension = res.json();
                                                    self.platform.get('/restapi/v1.0/account/~/extension/~/caller-id').then(function(call_details) {
                                                        var call_details = call_details.json();
                                                        if(call_details.byDevice && call_details.byDevice[0] && call_details.byDevice[0].callerId && call_details.byDevice[0].callerId.phoneInfo.phoneNumber) {
                                                            self.message_number = call_details.byDevice[0].callerId.phoneInfo.phoneNumber;
                                                        }else{
                                                            self.message_number = null
                                                        }
                                                    })
                                                    self.platform.get('/restapi/v1.0/account/~').then(function(account_details) {
                                                        var account_json = account_details.json();
                                                        self.username = account_json.mainNumber;
                                                        // self.account_id = action_json.id
                                                    })
                                                    self.platform.get('/restapi/v1.0/account/~/extension/~/phone-number?usageType=DirectNumber').then(function(response) {
                                                         var response = response.json();
                                                         self.message_number = response.records && response.records[0].phoneNumber
                                                     })
                                                    return self.platform.post('/client-info/sip-provision', {
                                                        sipInfo: [{
                                                            transport: 'WSS'
                                                        }]
                                                    });
                                                })
                                                .then(function(res) {

                                                    return res.json();
                                                })
                                                .then(function(data) {
                                                    if (self.loggedin) {
                                                        self.register(data)
                                                    }
                                                })
                                                .catch(function(e) {
                                                    alert('Error Occured: ' + e);
                                                    //                                              win.close();
                                                });
                                        } else {
                                            win.close();
                                            window.clearInterval(pollOAuth);
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            if (e instanceof TypeError) {
                                win.close();
                                window.clearInterval(pollOAuth);
                            }
                        }
                    }, 100);
                }
            }
            var oauth = new OAuthCode(self.rcsdk, {
                RC_APP_KEY: appKey,
                RC_APP_SECRET: appSecret,
                RC_APP_SERVER_URL: server,
                RC_APP_REDIRECT_URL: redirectUri,
                MY_APP_HOST: appHost,
                MY_APP_PORT: appPost
            });
            oauth.loginPopup()
        },
        sub_login: function(self, server, appKey, appSecret, redirectUri, appHost, appPost) {
            self.platform.get('/restapi/v1.0/account/~/extension/~')
                .then(function(res) {
                    self.loggedin = true;
                    //              self.platform.get('/restapi/v1.0/account/~').then(function(account_details){
                    //                  var account_json = account_details.json();
                    //                  self.username = account_json.mainNumber;
                    //              })
                    $(self.$el).find('.fa-sign-in').addClass('d-none')
                    $(self.$el).find('.fa-sign-out').removeClass('d-none')
                    $(self.$el).find(".menu_sign_in_out_li").attr('title', 'Sign Out')
                    $(self.$el).find(".menu_sign_in_out_li").siblings().show();
                    $(self.$el).find('.menu-panels').css('display', 'block');
                    self.extension = res.json();
                    self.platform.post('/client-info/sip-provision', {
                            sipInfo: [{
                                transport: 'WSS'
                            }]
                        })
                        .then(function(res) {
                            return res.json();
                        })
                        .then(function(data) {
                            if (self.loggedin) {
                                self.register(data)
                            }
                        })
                        .catch(function(e) {
                            alert('Error Occured: ' + e);
                        });
                })
        },
        login: function(server, appKey, appSecret, redirectUri, appHost, appPost) {
            var self = this;

            self.platform.get('/restapi/v1.0/account/~/extension/~/address-book/contact').then(function(account_details) {
                var account_json = account_details.json();
                _.each(account_json['records'], function(value) {

                    rpc.query({
                        model: 'res.partner',
                        method: 'search',
                        args: [
                            [
                                ['ringcentral_id', '=', value['id']]
                            ]
                        ],
                        context: session.context
                    }).then(function(all_res_users) {
                        if (all_res_users.length > 0) {

                        } else {
                            rpc.query({
                                model: 'res.partner',
                                method: 'create',
                                args: [{
                                    'ringcentral_id': value['id'],
                                    'name': value['firstName'],
                                    'phone': value['homePhone']
                                }],
                                context: session.context
                            })

                        }
                    })

                })

            })

            if (!self.platform._isAccessTokenValid()) {
                //              self.refresh_token_request()
                self.platform.refresh().then(function(res) {
                    var obj = JSON.parse(res.text());
                    self.loggedin = true;
                    localStorage.setItem("access_token", obj.access_token);
                    localStorage.setItem('refresh_token', obj.refresh_token)
                    self.access_token = obj.access_token;
                    self.refresh_token = obj.refresh_token;

                }).then(function() {
                    self.sub_login(self, server, appKey, appSecret, redirectUri, appHost, appPost)
                }).catch(function(e) {
                    //                  if ($(currentTarget).find('.menu-close:visible').length){
                    alert('Please Sign in.');
                    //                  }
                })
            } else {
                self.sub_login(self, server, appKey, appSecret, redirectUri, appHost, appPost)
            }
        },
        register: function(data) {
            var self = this;
            self.sipInfo = data.sipInfo[0] || data.sipInfo;
            self.webPhone = new RingCentral.WebPhone(data, {
                appKey: self.appKey,
                audioHelper: {
                    enabled: true,
                    incoming: '/ringcentral/static/src/audio/incoming.ogg',
                    outgoing: '/ringcentral/static/src/audio/outgoing.ogg'
                },
                logLevel: parseInt(self.logLevel, 10)
            });

            self.webPhone.userAgent.on('invite', function(session) {
                self.onInvite(session)
            });
            self.webPhone.userAgent.on('connecting', function() {
                console.log('UA connecting');
            });
            self.webPhone.userAgent.on('connected', function() {
                console.log('UA Connected');
            });
            self.webPhone.userAgent.on('disconnected', function() {
                console.log('UA Disconnected');
            });
            self.webPhone.userAgent.on('registered', function() {
                console.log('UA Registered');
            });
            self.webPhone.userAgent.on('unregistered', function() {
                console.log('UA Unregistered');
            });
            self.webPhone.userAgent.on('registrationFailed', function() {
                console.log('UA RegistrationFailed', arguments);
            });
            self.webPhone.userAgent.on('message', function() {
                console.log('UA Message', arguments);
            });



            self.platform.get('/restapi/v1.0/account/~').then(function(account_details) {
                var account_json = account_details.json();
                self.username = account_json.mainNumber;

                // self.account_id = account_json.id;
            })

            //          self.platform.get('/restapi/v1.0/account/~/extension/~/phone-number?usageType=DirectNumber').then(function(response) {
            //              var obj = JSON.parse(response.text());
            //              self.username = obj.records[0].phoneNumber
            //          })
            return self.webPhone;

        },
        makeCallForm: function(event = false, pnumber = false) {
            var self = this;
            // alert("called")
            if (self.loggedin) {
                var dialled_number = self.$el.find('#dialer').find('.custom-combobox-input').val();
                if (pnumber) {
                    dialled_number = pnumber;
                }
                if (dialled_number !== undefined && dialled_number) {

                    self.makeCall(self.filter_number(dialled_number));
                } else {
                    alert('Please Enter the Phone Number.')
                }
            } else {
                alert('You are not logged in in RingCentral. Please contact your Administrator.')
            }
        },
        dial_call_contact_detail: function(e) {
            var self = this;
            if (self.loggedin) {
                var dialled_number = $(e.currentTarget).data('phone_number')
                if (dialled_number !== undefined && dialled_number) {
                    self.makeCall(self.filter_number(dialled_number));
                } else {
                    alert('Please Enter the Phone Number.')
                }
            } else {
                alert('You are not logged in in RingCentral. Please contact your Administrator.')
            }
        },
        onInvite: function(session) {
            var self = this;
            var extension = false;
            var data = {}
            var number = session.request.headers.From[0]['raw']
            var incoming_call_number = "+".concat(number.split('+')[1].split('@')[0]);
            if (session.request.from.friendlyName.indexOf('@') > -1) {
                var call_from_number_list = session.request.from.friendlyName.split('@')[0]
            } else {
                var call_from_number_list = session.request.from.friendlyName
            }
            if (session.request.to.friendlyName.indexOf('@') > -1) {
                var call_to_number_list = session.request.to.friendlyName.split('@')[0]
                    //              if (call_to_number_list.indexOf('*') > -1){
                    //                  var call_to_number_list = call_to_number_list.split('*')[0]
                    //              }
            } else {
                var call_to_number_list = session.request.to.friendlyName
            }
            var from_name = '';
            for (var i = 0; i < self.contacts.length; i++) {
                if (self.contacts[i].phone && self.contacts[i].phone.indexOf(call_from_number_list) > -1 || self.contacts[i].mobile && self.contacts[i].mobile.indexOf(call_from_number_list) > -1) {
                    from_name = self.contacts[i].name;
                    break;
                }
            }
            var $modal_incoming_call = $(QWeb.render('ringcentral.incoming_call', {
                'from_number': call_from_number_list,
                'from_name': from_name
            }))
            var title = 'Incoming Call'
            if (from_name) {
                title += (' From ' + from_name);
            }
            if (call_from_number_list) {
                title += (' Number ' + call_from_number_list);
            }
            var incoming_dialog = new Dialog(this, {
                size: 'small',
                resizable: false,
                height: 160,
                title: _t(title),
                position: {
                    my: "center",
                    at: "center",
                    of: window
                },
                modal: true,
                buttons: [],
                $content: $('<div>', {
                    html: $modal_incoming_call,
                }),
            }).open();
            self._rpc({
                model : 'crm.phonecall',
                method :'get_partner_name',
                args : [incoming_call_number]
            }).then(function(result){
                data = result
                _.each(result, function(rec){
                    var tr = '<tr id="tr-click" data-id=' + rec.id + ' style="cursor: pointer;"><td>' + rec.name + '</td><td>' + rec.phone + '</td></tr>'
                    $modal_incoming_call.find('#phone_table_list').append(tr);
                })
                $modal_incoming_call.find('tr').on('click', function(ev) {
                        window.open(window.location.origin + "#id="+parseInt($(ev.currentTarget).attr('data-id'))+ "&action=" +self.contacts_action + "&model=res.partner&view_type=form", '_blank');
                    })
            })
            var acceptOptions = {
                media: {
                    render: {
                        remote: document.getElementById('remoteVideo'),
                        local: document.getElementById('localVideo')
                    }
                }
            };
            $modal_incoming_call.find('.answer').on('click', function() {
                session.accept(acceptOptions)
                    .then(function() {
                        $modal_incoming_call.remove();
                        incoming_dialog.close();
                        var to_name = '';
                        var from_name = '';
                        for (var i = 0; i < self.contacts.length; i++) {
                            if (self.contacts[i].phone && self.contacts[i].phone.indexOf(incoming_call_number) > -1 || self.contacts[i].mobile && self.contacts[i].mobile.indexOf(incoming_call_number) > -1) {
                                from_name = self.contacts[i].name
                                break;
                            }
                        }

                        self.onAccepted(session, incoming_call_number, self.username, 'in_bound', from_name, incoming_call_number, data);
                    })
                    .catch(function(e) {
                        console.log('Accept failed', e.stack || e);
                    });
            });
            $modal_incoming_call.find('.decline').on('click', function() {
                //              $modal_incoming_call.close();
                incoming_dialog.close();
                session.rejected();
            });
            $modal_incoming_call.find('.forward-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.forward($modal_incoming_call.find('input[name=forward]').val().trim(), acceptOptions)
                    .then(function() {})
                    .catch(function(e) {
                        console.log('Forward failed', e.stack || e);
                    });
            });
            session.on('rejected', function() {
                $modal_incoming_call.remove();
                incoming_dialog.close();
            });
            session.on('terminated', function() {
                incoming_dialog.close();
            });
            session.on('cancel', function() {
                incoming_dialog.close();
            });
        },
        makeCall: function(number) {
            var self = this;
            var homeCountry = (self.extension && self.extension.regionalSettings && self.extension.regionalSettings.homeCountry) ?
                self.extension.regionalSettings.homeCountry.id :
                null;

            var session = self.webPhone.userAgent.invite(number, {
                media: {
                    render: {
                        remote: document.getElementById('remoteVideo'),
                        local: document.getElementById('localVideo')
                    }
                },
                fromNumber: self.username,
                homeCountryId: homeCountry
            });
            var to_name = '';
            for (var i = 0; i < self.contacts.length; i++) {
                if (self.contacts[i].phone && self.contacts[i].phone.indexOf(number) > -1 || self.contacts[i].mobile && self.contacts[i].mobile.indexOf(number) > -1) {
                    to_name = self.contacts[i].name
                    break;
                }
            }
            self.onAccepted(session, number, self.username, 'out_bound', to_name, number);

        },
        cloneTemplate: function($tpl) {
            return $($tpl.html());
        },
        sub_onaccepted: function(self, session, to_number, from_number, type, caller_name, caller_number, data={}) {
            var $modal_outgoing_call = $(QWeb.render('ringcentral.outgoing_call', {
                'phonecall_about': self.phonecall_about_options
            }))
            if (data && (!data.length || data.length < 1)){
                self._rpc({
                    model : 'crm.phonecall',
                    method :'get_partner_name',
                    args : [to_number]
                }).then(function(result){
                    data = result
                    _.each(result, function(rec){
                        var tr = '<tr id="tr-click" data-id=' + rec.id + ' style="cursor: pointer;"><td>' + rec.name + '</td><td>' + rec.phone + '</td></tr>'
                        $modal_outgoing_call.find('#phone_table_list').append(tr);
                    })
                    $modal_outgoing_call.find('tr').on('click', function(ev) {
                        window.open(window.location.origin + "#id="+parseInt($(ev.currentTarget).attr('data-id'))+ "&action=" +self.contacts_action + "&model=res.partner&view_type=form", '_blank');
                        })
                })
            }else{
                _.each(data, function(rec){
                    var tr = '<tr id="tr-click" data-id=' + rec.id + ' style="cursor: pointer;"><td>' + rec.name + '</td><td>' + rec.phone + '</td></tr>'
                    $modal_outgoing_call.find('#phone_table_list').append(tr);
                })
                $modal_outgoing_call.find('tr').on('click', function(ev) {
                        window.open(window.location.origin + "#id="+parseInt($(ev.currentTarget).attr('data-id'))+ "&action=" +self.contacts_action + "&model=res.partner&view_type=form", '_blank');
                        })
            }
            var title = "Call In Progress with ";
            if (caller_name) {
                title += caller_name
            } else {
                title += caller_number
            }
            var dialog = new Dialog(this, {
                size: 'small',
                resizable: false,
                height: 370,
                title: _t(title),
                position: {
                    my: "center",
                    at: "center",
                    of: window
                },
                modal: false,
                buttons: [],
                $content: $('<div>', {
                    html: $modal_outgoing_call,
                }),
            })            // ======= Function for minimize and maximize phonecall modal ======
            dialog.opened().then(function () {
                var $modal_title = dialog.$content.parent().find('.modal-title')
                $modal_title.before('<button class="btn btn-minimize" title="minimize"><i class="fa fa-window-minimize"></i></button>')
                $modal_title.before('<button class="btn btn-maximize hidden d-none" title="maximize"><i class="fa fa-window-maximize"></i></button>')
                
                $('.btn-minimize').on('click', function() {
                    $(this).parents('.modal-content').animate({}, 500);
                    var $header = $(this).parents('.modal-content').find('.modal-header')
                    $(this).addClass('d-none')
                    $header.find('.btn-maximize').removeClass('d-none')
                    $(this).parents('.modal').removeClass('enable_back')
                    $(this).parents('.modal').addClass('mini_modal')
                    $(this).parents('.modal').css({'left':'8px', 'top': '516px', 'width': '350px', 'height': '79px'})
                    $(this).parents('.modal-content').find('.modal-header').addClass('bg-primary')
                    $(this).parents('.modal-content').find('.modal-title').addClass('text-white')
                    $(this).parents('.modal-content').find('.modal-body').addClass('d-none')
                    $(this).parents('.modal-content').find('.modal-footer').addClass('d-none')
                    $(".modal-backdrop").remove();
                });
                
                $('.btn-maximize').click(function() {
                    $(this).parents('.modal-content').animate({}, 500);
                    $(this).parents('.modal').removeClass('mini_modal')
                    $(this).parents('.modal').addClass('enable_back');
                    $(this).parents('.modal').css({'position': 'fixed','top': '0',
                        'right': '0', 'bottom': '0', 'left': '0', 'height': '560px', 
                        'width': '310px'
                    });
                    $(this).parents('.modal-content').find('.modal-header').removeClass('bg-primary')
                    $(this).parents('.modal-content').find('.modal-title').removeClass('text-white')
                    $(this).addClass('d-none');
                    $(this).parents('.modal').find('.btn-minimize').removeClass('d-none');
                    $(this).parents('.modal-content').find('.modal-body').removeClass('d-none');
                    $(this).parents('.modal-content').find('.modal-footer').removeClass('d-none');
                });
                
                //===== make phonecall modal Draggable =====
                dialog.$content.parents('.modal').draggable({
                    handle: ".modal-header"
                });
            })
            dialog.open();
            // dialog.on('closed', this, function() {
            //     session.terminate();
            // });
            setTimeout(function(){
                $(".modal-backdrop").remove();
                $('.modal').addClass('enable_back');
            }, 500)
            var $info = $modal_outgoing_call.find('.info').eq(0);
            var $dtmf = $modal_outgoing_call.find('input[name=dtmf]').eq(0);
            var $transfer = $modal_outgoing_call.find('input[name=transfer]').eq(0);
            var $flip = $modal_outgoing_call.find('input[name=flip]').eq(0);

            var interval = setInterval(function() {
                var time = session.startTime ? (Math.round((Date.now() - session.startTime) / 1000) + 's') : 'Ringing';
                $info.text(
                    'time: ' + time + '\n' +
                    'startTime: ' + JSON.stringify(session.startTime, null, 2) + '\n'
                );
            }, 1000);

            function close() {
                clearInterval(interval);
                dialog.close();
            }
            $modal_outgoing_call.find('.mute').on('click', function() {
                session.mute();
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.unmute').removeClass('d-none')
            });
            $modal_outgoing_call.find('.unmute').on('click', function() {
                session.unmute();
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.mute').removeClass('d-none')
            });
            $modal_outgoing_call.find('.hold').on('click', function() {
                session.hold().then(function() {
                    console.log('Holding');
                }).catch(function(e) {
                    console.error('Holding failed', e.stack || e);
                });
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.unhold').removeClass('d-none')
            });
            $modal_outgoing_call.find('.unhold').on('click', function() {
                session.unhold().then(function() {
                    console.log('UnHolding');
                }).catch(function(e) {
                    console.error('UnHolding failed', e.stack || e);
                });
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.hold').removeClass('d-none')
            });
            $modal_outgoing_call.find('.startRecord').on('click', function() {
                session.startRecord()
                alert("record started")
                    //                .then(function() { console.log('Recording Started'); }).catch(function(e) { console.error('Recording Start failed', e.stack || e); });
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.stopRecord').removeClass('d-none')
            });
            $modal_outgoing_call.find('.stopRecord').on('click', function() {
                session.stopRecord()
                alert("record stopped")
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.startRecord').removeClass('d-none')
            });
            $modal_outgoing_call.find('.park').on('click', function() {
                session.park().then(function() {
                    console.log('Parked');
                }).catch(function(e) {
                    console.error('Park failed', e.stack || e);
                });
            });
            $modal_outgoing_call.find('.transfer-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.transfer($transfer.val().trim()).then(function() {
                    console.log('Transferred');
                }).catch(function(e) {
                    console.error('Transfer failed', e.stack || e);
                });
                $transfer.val('');
            });
            $modal_outgoing_call.find('.flip-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.flip($flip.val().trim()).then(function() {
                    console.log('Flipped');
                }).catch(function(e) {
                    console.error('Flip failed', e.stack || e);
                });
                $flip.val('');
            });
            $modal_outgoing_call.find('.dtmf-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.dtmf($dtmf.val().trim());
                $dtmf.val('');
            });
            $modal_outgoing_call.find('.hangup').on('click', function() {
                session.terminate();
                dialog.close()
            });
            $modal_outgoing_call.find('.mute').on('click', function() {
                session.mute();
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.unmute').removeClass('d-none')
            });
            $modal_outgoing_call.find('.unmute').on('click', function() {
                session.unmute();
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.mute').removeClass('d-none')
            });

            $modal_outgoing_call.find('.hold').on('click', function() {
                session.hold().then(function() {
                    console.log('Holding');
                }).catch(function(e) {
                    console.error('Holding failed', e.stack || e);
                });
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.unhold').removeClass('d-none')
            });

            $modal_outgoing_call.find('.unhold').on('click', function() {
                session.unhold().then(function() {
                    console.log('UnHolding');
                }).catch(function(e) {
                    console.error('UnHolding failed', e.stack || e);
                });
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.hold').removeClass('d-none')
            });
            $modal_outgoing_call.find('.startRecord').on('click', function() {
                session.startRecord()
                alert("record started")
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.stopRecord').removeClass('d-none')
            });

            $modal_outgoing_call.find('.stopRecord').on('click', function() {
                session.stopRecord()
                alert("record stopped")
                $(this).addClass('d-none');
                $modal_outgoing_call.find('.startRecord').removeClass('d-none')
            });

            $modal_outgoing_call.find('.park').on('click', function() {
                session.park().then(function() {
                    console.log('Parked');
                }).catch(function(e) {
                    console.error('Park failed', e.stack || e);
                });
            });

            $modal_outgoing_call.find('.transfer-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.transfer($transfer.val().trim()).then(function() {
                    console.log('Transferred');
                }).catch(function(e) {
                    console.error('Transfer failed', e.stack || e);
                });
                $transfer.val('');
            });

            $modal_outgoing_call.find('.flip-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.flip($flip.val().trim()).then(function() {
                    console.log('Flipped');
                }).catch(function(e) {
                    console.error('Flip failed', e.stack || e);
                });
                $flip.val('');
            });

            $modal_outgoing_call.find('.dtmf-form').on('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                session.dtmf($dtmf.val().trim());
                $dtmf.val('');
            });
            session.on('accepted', function() {
                console.log('Event: Accepted');

            });
            session.on('progress', function() {
                console.log('Event: Progress');
            });
            session.on('rejected', function() {
                console.log('Event: Rejected');

                rpc.query({
                    model: 'crm.phonecall',
                    method: 'create',
                    args: [{
                        'name': from_number,
                        'type': type,
                        'partner_phone': to_number,
                        'date': new moment(),
                        'description': $modal_outgoing_call.find('#description').val(),
                        'crm_phonecall_about_id': $modal_outgoing_call.find('select[name="phonecall_about"]').val()
                    }],
                })
                close();
            });
            session.on('failed', function() {
                console.log('Event: Failed');
                close();
            });
            session.on('terminated', function() {
                self.platform.get('/restapi/v1.0/account/~/extension/~/call-log-sync?statusGroup=All&syncType=FSync&recordCount=1').then(function(results) {

                    var record = results.json()
                    var rec_li = [];
                    _.each(record['records'], function(result) {
                        if (result && result.from && (result.from.phoneNumber == to_number && result.result == 'Accepted' || result.to.phoneNumber == to_number && result.result == 'Call connected')) {
                            var url = self.ringcentral_service_uri.split("/login/");
                            
                            var  duration = result.duration / 60
                            var time = new Date().getTime()
                            var rec_type = ''
                            if (result.recording) {
                                if (result.recording.type == 'Automatic') {
                                    rec_type = 'Auto'
                                } else {
                                    rec_type = result.recording.type
                                }
                                
                                var str = url[0] + '/mobile/media?cmd=downloadMessage&msgid=' + result.recording.id + '&useName=true&time=' + '1554700788480' + '&msgExt=&msgNum=' + result.from.phoneNumber + '&msgDir=' + result.direction + '&msgRecType=' + rec_type + '&msgRecId=' + result.recording.id + '&type=1&download=1&saveMsg=&file=.mp3'
                                
                            }
                            var data_li = []
                                    if (result.legs) {
                                        _.each(result.legs, function(leg) {
                                            var val = {
                                                'name': leg.action,
                                                'call_type': leg.direction,
                                                'leg_type': leg.legType,
                                                'from_number': leg.from.phoneNumber,
                                                'to_number': leg.to.phoneNumber
                                            }
                                            data_li.push([0, 0, val])
                                        })
                                    }
                                    if (result.recording) {
                                rpc.query({
                                    model: 'crm.phonecall',
                                    method: 'create_search_voip',
                                    args: [{
                                        'name': from_number,
                                        'type': type,
                                        'partner_phone': to_number,
                                        'date': moment.utc(result.startTime),
                                        'description': $modal_outgoing_call.find('#description').val(),
                                        'duration': duration,
                                        'crm_phonecall_about_id': $modal_outgoing_call.find('select[name="phonecall_about"]').val(),
                                        'ringcentral_call_id': result.id,
                                        'ringcentral_call_url': str,
                                        'is_recording': true,
                                        'crm_call_activity_ids': data_li
                                    }],
                                })
                            } else {
                                rpc.query({
                                    model: 'crm.phonecall',
                                    method: 'create_search_voip',
                                    args: [{
                                        'name': from_number,
                                        'type': type,
                                        'partner_phone': to_number,
                                        'date': moment.utc(result.startTime),
                                        'description': $modal_outgoing_call.find('#description').val(),
                                        'duration': duration,
                                        'crm_phonecall_about_id': $modal_outgoing_call.find('select[name="phonecall_about"]').val(),
                                        'ringcentral_call_id': result.id,
                                        'crm_call_activity_ids': data_li
                                    }],
                                })
                            }
                        }
                    })
                    console.log('Event: Terminated');
                });
            });
            session.on('cancel', function() {
                console.log('Event: Cancel');
                close();
            });
            session.on('refer', function() {
                console.log('Event: Refer');
                close();
            });
            session.on('replaced', function(newSession) {
                console.log('Event: Replaced: old session', session, 'has been replaced with', newSession);
                close();
                onAccepted(newSession);
            });
            session.on('dtmf', function() {
                console.log('Event: DTMF');
            });
            session.on('muted', function() {
                console.log('Event: Muted');
            });
            session.on('unmuted', function() {
                console.log('Event: Unmuted');
            });
            session.on('connecting', function() {
                console.log('Event: Connecting');
            });
            session.on('bye', function() {
                console.log('Event: Bye');
                self.platform.get('/restapi/v1.0/account/~/extension/~/call-log-sync?statusGroup=All&syncType=FSync&recordCount=1').then(function(results) {

                        var record = results.json()
                        var rec_li = [];
                        _.each(record['records'], function(result) {
                            if (result && result.from && (result.from.phoneNumber == to_number && result.result == 'Accepted' || result.to.phoneNumber == to_number && result.result == 'Call connected')) {
                                var url = self.ringcentral_service_uri.split("/login/");
                                var time = new Date().getTime()
                                var rec_type = ''
                                var str = ''
                                var data_li = []
                                var duration = result.duration / 60
                                if (result.legs) {
                                    _.each(result.legs, function(leg) {
                                        var val = {
                                            'name': leg.action,
                                            'call_type': leg.direction,
                                            'leg_type': leg.legType,
                                            'from_number': leg.from.phoneNumber,
                                            'to_number': leg.to.phoneNumber
                                        }
                                        data_li.push([0, 0, val])
                                    })
                                }
                                if (result.recording) {
                                    if (result.recording.type == 'Automatic') {
                                        rec_type = 'Auto'
                                    } else {
                                        rec_type = result.recording.type
                                    }
                                    
                                    var str = url[0] + '/mobile/media?cmd=downloadMessage&msgid=' + result.recording.id + '&useName=true&time=' + '1554700788480' + '&msgExt=&msgNum=' + result.from.phoneNumber + '&msgDir=' + result.direction + '&msgRecType=' + rec_type + '&msgRecId=' + result.recording.id + '&type=1&download=1&saveMsg=&file=.mp3'
                                    rpc.query({
                                        model: 'crm.phonecall',
                                        method: 'create_search_voip',
                                        args: [{
                                            'name': from_number,
                                            'type': type,
                                            'partner_phone': to_number,
                                            'date': moment.utc(result.startTime),
                                            'description': $modal_outgoing_call.find('#description').val(),
                                            'duration': duration,
                                            'crm_phonecall_about_id': $modal_outgoing_call.find('select[name="phonecall_about"]').val(),
                                            'ringcentral_call_id': result.id,
                                            'ringcentral_call_url': str,
                                            'is_recording': true,
                                            'crm_call_activity_ids': data_li
                                        }],
                                    })
                                } else {
                                    rpc.query({
                                        model: 'crm.phonecall',
                                        method: 'create_search_voip',
                                        args: [{
                                            'name': from_number,
                                            'type': type,
                                            'partner_phone': to_number,
                                            'date': moment.utc(result.startTime),
                                            'description': $modal_outgoing_call.find('#description').val(),
                                            'duration': duration,
                                            'crm_phonecall_about_id': $modal_outgoing_call.find('select[name="phonecall_about"]').val(),
                                            'ringcentral_call_id': result.id,
                                            'crm_call_activity_ids': data_li
                                        }],
                                    })
                                }
                            }
                        })
                    })
                close();
            });
            session.mediaHandler.on('iceConnection', function() {
                console.log('Event: ICE: iceConnection');
            });
            session.mediaHandler.on('iceConnectionChecking', function() {
                console.log('Event: ICE: iceConnectionChecking');
            });
            session.mediaHandler.on('iceConnectionConnected', function() {
                console.log('Event: ICE: iceConnectionConnected');
            });
            session.mediaHandler.on('iceConnectionCompleted', function() {
                console.log('Event: ICE: iceConnectionCompleted');
            });
            session.mediaHandler.on('iceConnectionFailed', function() {
                console.log('Event: ICE: iceConnectionFailed');
            });
            session.mediaHandler.on('iceConnectionDisconnected', function() {
                console.log('Event: ICE: iceConnectionDisconnected');
            });
            session.mediaHandler.on('iceConnectionClosed', function() {
                console.log('Event: ICE: iceConnectionClosed');
            });
            session.mediaHandler.on('iceGatheringComplete', function() {
                console.log('Event: ICE: iceGatheringComplete');
            });
            session.mediaHandler.on('iceGathering', function() {
                console.log('Event: ICE: iceGathering');
            });
            session.mediaHandler.on('iceCandidate', function() {
                console.log('Event: ICE: iceCandidate');
            });
            session.mediaHandler.on('userMedia', function() {
                console.log('Event: ICE: userMedia');
            });
            session.mediaHandler.on('userMediaRequest', function() {
                console.log('Event: ICE: userMediaRequest');
            });
            session.mediaHandler.on('userMediaFailed', function() {
                console.log('Event: ICE: userMediaFailed');
            });
        },
        onAccepted: function(session, to_number, from_number, type, caller_name, caller_number, data={}) {
            var self = this;
            if (!self.platform._isAccessTokenValid()) {
                //              self.refresh_token_request()
                self.platform.refresh().then(function(res) {
                    var obj = JSON.parse(res.text());
                    self.loggedin = true;
                    localStorage.setItem("access_token", obj.access_token);
                    localStorage.setItem('refresh_token', obj.refresh_token)
                    self.access_token = obj.access_token;
                    self.refresh_token = obj.refresh_token;
                }).then(function() {
                    self.sub_onaccepted(self, session, to_number, from_number, type, caller_name, caller_number)
                }).catch(function(e) {
                    console.log('Error: ' + e.message)
                        //                  if ($(currentTarget).find('.menu-close:visible').length){
                    alert('Please Sign in.');
                    //                  }
                })
            } else {
                self.sub_onaccepted(self, session, to_number, from_number, type, caller_name, caller_number, data = data)
            }
        },
        fetch_call_log_details: function(self) {
            var d = new Date();
            d.setDate(d.getDate() - 7);
            return self.platform.get('/account/~/extension/~/call-log').then(function(response) {
                var txt = JSON.stringify(response.data, null, 2);
                var calls = response.json().records;
                if (calls) {
                    for (var i = 0; i < self.contacts.length; i++) {
                        for (var j = 0; j < calls.length; j++) {

                            if (self.contacts[i].phone == calls[j]["to"]["phoneNumber"] || self.contacts[i].mobile == calls[j]["to"]["phoneNumber"]) {
                                calls[j]["to"]["name"] = self.capitalizeFirstLetter(self.contacts[i].name || self.contacts[i].phone)
                            } else {
                                if (calls[j]["to"]["name"]) {
                                    calls[j]["to"]["name"] = self.capitalizeFirstLetter(calls[j]["to"]["name"])
                                }
                            }
                        }
                    }
                }
                return calls
            })
        },
        float_time: function (number) {
            // Check sign of given number
            var sign = (number >= 0) ? 1 : -1;

            // Set positive value of number of sign negative
            number = number * sign;

            // Separate the int from the decimal part
            var hour = Math.floor(number);
            var decpart = number - hour;

            var min = 1 / 60;
            // Round to nearest minute
            decpart = min * Math.round(decpart / min);

            var minute = Math.floor(decpart * 60) + '';

            // Add padding if need
            if (minute.length < 2) {
                minute = '0' + minute;
            }

            // Add Sign in final result
            sign = sign == 1 ? '' : '-';

            // Concate hours and minutes
            var time = sign + hour + ':' + minute;

            return time;
        },
        get_partner_name : function(number){
            var self = this
            var name = _.find(self.contacts_partner, function(partner){
                if  (partner.phone == number || partner.mobile == number){
                    return partner.name
                }
            })
            if (name){
                return name.name
            }
            return false
        },
        load_callLog_on_dialpad: function(ev) {
            var self = this;
            if (!self.platform._isAccessTokenValid()) {
                self.platform.refresh().then(function(res) {
                    var obj = JSON.parse(res.text());
                    self.loggedin = true;
                    localStorage.setItem("access_token", obj.access_token);
                    localStorage.setItem('refresh_token', obj.refresh_token)
                    self.access_token = obj.access_token;
                    self.refresh_token = obj.refresh_token;
                }).then(function() {
                    self.fetch_call_log_details(self).then(function(call_log_list) {
                        self.$el.find('#dial_all_calls').css('max-height', $(self.$el).find('.menu-panels').height() - $(self.$el).find('#dial_all_calls').parent().parent().find('.panel-body').height() - 140)
                        self.$el.find('#duriial_missed_calls').css('max-height', $(self.$el).find('.menu-panels').height() - $(self.$el).find('#dial_all_calls').parent().parent().find('.panel-body').height() - 140)
                        self.$el.find('#dial_all_calls').html(QWeb.render('ringcentral.all_calllog', {
                            'widget' : self,
                            'all_calls': call_log_list,
                            'record_length': call_log_list.length
                        }))
                        self.$el.find('#dial_missed_calls').html(QWeb.render('ringcentral.miss_calllog', {
                            'widget' : self,
                            'all_calls': call_log_list,
                            'record_length': call_log_list.length
                        }))
                    })
                }).catch(function(e) {
                    if ($(ev.currentTarget).find('.menu-close:visible').length) {
                        alert('Please Sign in.');
                    }
                })
            } else {
                self.fetch_call_log_details(self).then(function(call_log_list) {
                    self.$el.find('#dial_all_calls').css('max-height', $(self.$el).find('.menu-panels').height() - $(self.$el).find('#dial_all_calls').parent().parent().find('.panel-body').height() - 140)
                    self.$el.find('#dial_missed_calls').css('max-height', $(self.$el).find('.menu-panels').height() - $(self.$el).find('#dial_all_calls').parent().parent().find('.panel-body').height() - 140)
                    self.$el.find('#dial_all_calls').html(QWeb.render('ringcentral.all_calllog', {
                        'widget' : self,
                        'all_calls': call_log_list,
                        'record_length': call_log_list.length
                    }))
                    self.$el.find('#dial_missed_calls').html(QWeb.render('ringcentral.miss_calllog', {
                        'widget' : self,
                        'all_calls': call_log_list,
                        'record_length': call_log_list.length
                    }))
                })
            }
        },
        load_callLog: function(e) {
            var self = this;
            if (!self.platform._isAccessTokenValid()) {
                self.platform.refresh().then(function(res) {
                    var obj = JSON.parse(res.text());
                    self.loggedin = true;
                    localStorage.setItem("access_token", obj.access_token);
                    localStorage.setItem('refresh_token', obj.refresh_token)
                    self.access_token = obj.access_token;
                    self.refresh_token = obj.refresh_token;
                }).then(function() {
                    self.fetch_call_log_details(self).then(function(call_log_list) {
                        self.$el.find('#all_calls').html(QWeb.render('ringcentral.all_calllog', {
                            'widget' : self,
                            'all_calls': call_log_list,
                            'record_length': call_log_list.length
                        })).css('max-height', $(self.$el).find('.menu-panels').height() - 110)
                        self.$el.find('#missed_calls').html(QWeb.render('ringcentral.miss_calllog', {
                            'widget' : self,
                            'all_calls': call_log_list,
                            'record_length': call_log_list.length
                        })).css('max-height', $(self.$el).find('.menu-panels').height() - 110)
                    })
                }).catch(function(e) {
                    if ($(ev.currentTarget).find('.menu-close:visible').length) {
                        alert('Please Sign in.');
                    }
                })
            } else {
                self.fetch_call_log_details(self).then(function(call_log_list) {
                    self.$el.find('#all_calls').html(QWeb.render('ringcentral.all_calllog', {
                        'widget' : self,
                        'all_calls': call_log_list,
                        'record_length': call_log_list.length
                    })).css('max-height', $(self.$el).find('.menu-panels').height() - 110)
                    self.$el.find('#missed_calls').html(QWeb.render('ringcentral.miss_calllog', {
                        'widget' : self,
                        'all_calls': call_log_list,
                        'record_length': call_log_list.length
                    })).css('max-height', $(self.$el).find('.menu-panels').height() - 110)
                })
            }
        },
        format_datetime: function(date) {
            var d = new Date(date);
            var hh = d.getHours();
            var m = d.getMinutes();
            var s = d.getSeconds();
            var dd = "AM";
            var h = hh;
            if (h >= 12) {
                h = hh - 12;
                dd = "PM";
            }
            if (h == 0) {
                h = 12;
            }
            m = m < 10 ? "0" + m : m;

            s = s < 10 ? "0" + s : s;

            /* if you want 2 digit hours:
            h = h<10?"0"+h:h; */

            var pattern = new RegExp("0?" + hh + ":" + m + ":" + s);

            var replacement = h + ":" + m;
            /* if you want to add seconds
            replacement += ":"+s;  */
            replacement += " " + dd;

            return date.replace(pattern, replacement);
        },
        click_attchment: function(e) {
            var self = this;
            var e = e[0].attributes['data-id'].nodeValue
            rpc.query({
                model: 'crm.phonecall',
                method: 'search',
                args: [
                    [
                        ['ringcentral_message_id', '=', e]
                    ]
                ]
            }).then(function(record) {
                if (record.length > 0) {
                    self.do_action({
                        type: 'ir.actions.act_window',
                        res_model: 'crm.phonecall',
                        res_id: record[0],
                        views: [
                            [false, 'form']
                        ],
                        target: 'new',
                        flags: {
                            mode: 'readonly'
                        }
                    });
                }
            })
        },
        load_sent_messages: function() {
            var self = this;
            self.platform.get('/restapi/v1.0/account/~/extension/~/message-store?availability=Alive&dateFrom=' + self.dateBefore2days).then(function(msg_data) {
                var messages = msg_data.json().records;
                self.messages = []
                _.each(messages, function(message) {
                    var date = message.creationTime.split("T")
                    var time = date[1].split(".")
                    var datetime = date[0] + ' ' + time[0]
                    message.datetime = datetime
                    self.messages.push(message.id)
                })
                rpc.query({
                    model: 'crm.phonecall',
                    method: 'ac_search_read',
                    args: []
                }).then(function(result) {
                    var rec_list = []
                    for (var j = 0; j < messages.length; j++) {
                        var msg_id = messages[j].id.toString()
                        if (result.indexOf(msg_id) == -1) {
                            result.push(msg_id)
                            rec_list.push(messages[j])
                        }
                    }
                    if (rec_list.length > 0) {
                        rpc.query({
                            model: 'crm.phonecall',
                            method: 'create_message',
                            args: [rec_list]
                        })
                    }
                    for (var i = 0; i < self.contacts.length; i++) {
                        for (var j = 0; j < messages.length; j++) {
                            var msg_id = messages[j].id.toString()
                            if (messages[j]["direction"] == "Outbound") {
                                for (var k = 0; k < messages[j]["to"].length; k++) {
                                    if (self.contacts[i].phone == messages[j]["to"][k]["phoneNumber"] || self.contacts[i].mobile == messages[j]["to"][k]["phoneNumber"]) {
                                        messages[j]["to"][k]["partner_name"] = self.capitalizeFirstLetter(self.contacts[i].name || self.contacts[i].phone)
                                    }
                                }
                            } else if (messages[j]["direction"] == "Inbound") {
                                if (self.contacts[i].phone == messages[j]["from"]["phoneNumber"] || self.contacts[i].mobile == messages[j]["from"]["phoneNumber"]) {
                                    messages[j]["from"]['partner_name'] = self.capitalizeFirstLetter(self.contacts[i].name || self.contacts[i].phone)
                                }
                            }
                        }
                    }
                })
                var partner_list = []
                var partner_message = []
                for (var j = 0; j < messages.length; j++) {
                    if (messages[j].direction == 'Inbound') {
                        if (partner_list.indexOf(messages[j]["from"]["phoneNumber"]) == -1) {
                            partner_list.push(messages[j]["from"]["phoneNumber"])
                            partner_message.push({
                                'phoneNumber': messages[j]["from"]["phoneNumber"]
                            })
                        }

                    } else if (messages[j].direction == 'Outbound') {
                        for (var k = 0; k < messages[j]["to"].length; k++) {
                            if (partner_list.indexOf(messages[j]["to"][k]["phoneNumber"]) == -1) {
                                partner_list.push(messages[j]["to"][k]["phoneNumber"])
                                partner_message.push({
                                    'phoneNumber': messages[j]["to"][k]["phoneNumber"]
                                })
                            }
                        }
                    }
                }
                $(self.$el).animate({
                    scrollTop: $(self.$el).prop("scrollHeight")
                }, 500);
                // $(self.$el).find('.sent_text_messages_in_compose').css('max-height', $(self.$el).find('.menu-panels').height() - $(self.$el).find('#compose_message_child_1').height() - 100)
                var message = $(QWeb.render('ringcentral.messages_partner', {
                    'all_messages': partner_message,
                    'datetime_conversion': function(datetime) {
                        var nowDate = new Date(datetime);
                        var month = nowDate.getMonth() + 1;
                        var seconds = nowDate.getSeconds()
                        if (month < 10) {
                            month = '0' + month
                        }
                        if (seconds < 10) {
                            seconds = '0' + seconds
                        }
                        return self.format_datetime(month + '-' + nowDate.getDate() + '-' + nowDate.getFullYear() + ' ' + nowDate.getHours() + ':' + nowDate.getMinutes() + ':' + seconds)
                    }
                }))
                messages.reverse()
                message.on('click', 'li', function(e) {
                    self.title_popup = e.currentTarget.innerText
                    var chat_box = $(QWeb.render("ringcentral.message_box", {
                        'widget': self,
                        'messages': messages,
                        'title': self.title_popup
                    }))
                    chat_box.on('click', '#send_btn', function() {
                        if ($('#popup_input')[0].value == '') {
                            alert('Please write message')
                        } else {
                            self.send_popup_msg()
                        }
                    })
                    var dialog = new Dialog(self, {
                        size: 'medium',
                        $content: chat_box,
                        title: _t(self.title_popup),
                        buttons: []
                    })
                    dialog.open()
                    $('#scroll_messge').animate({
                        scrollTop: $('#scroll_messge').prop("scrollHeight")
                    }, 500);
                    self.do_recursive_alert()
                });
                self.$el.find('#sent_text_messages,.sent_text_messages_in_compose').html(message)

                $('[data-toggle="popover"]').popover();
            })
        },
        send_popup_msg: function() {
            var self = this;
            if (!self.platform._isAccessTokenValid()) {
                self.refresh_token_request()
            }
            var msg_text = $('#popup_input')[0].value;
            var msg_to = self.title_popup;
            if (!self.message_number){
                self.message_number = self.username
            }
            var body = {
                from: {
                    phoneNumber: self.message_number
                },
                to: [{
                    phoneNumber: self.title_popup
                }],
                text: msg_text
            }
            var formData = new FormData()
            formData.append('json', new File([JSON.stringify(body)], 'request.json', {
                type: 'application/json'
            }))
            var image_file = $('#popup_file')
            var values_list = []
            if (image_file[0].files.length > 0) {
                _.each(image_file[0].files, function(image) {
                    formData.append('attachment', image)
                    var reader = new FileReader();
                    reader.onload = function() {
                        var result = reader.result
                        var data64 = result.split(',')[1];
                        var values = {
                            'name': image.name,
                            'type': 'binary',
                            'datas': data64,
                        };
                        values_list.push([0, 0, values]);
                    }
                    reader.readAsDataURL(image_file[0].files[0]);
                })
            }
            if (self.loggedin) {
                if (msg_text && msg_to) {
                    self.platform.post('/account/~/extension/~/sms', formData)
                        .then(function(response) {
                            var response_json = response.json()
                            rpc.query({
                                model: 'crm.phonecall',
                                method: 'create',
                                args: [{
                                    'name': self.username,
                                    'type': 'sent',
                                    'partner_phone': self.filter_number(msg_to),
                                    'date': new Date(),
                                    'description': msg_text,
                                    'attachment_ids': values_list,
                                    'ringcentral_message_id': response.json().id
                                }],
                            })
                            var date = response_json.creationTime.split("T")
                            var time = date[1].split(".")
                            var datetime = date[0] + ' ' + time[0]
                            response_json.datetime = datetime
                            $('#popup_input')[0].value = '';
                            $('#popup_file')[0].value = '';
                            var div_html = "<div class='d-flex justify-content-end mb-4'>" + "<div class='msg_cotainer_send'>" + response.json().subject + "<span class='msg_time_send'>" + response_json.datetime + "</span></div></div>"
                            _.each(response_json.attachments, function(attachment) {
                                if (attachment.type == 'MmsAttachment') {
                                    var uri = attachment.uri + '?access_token=' + self.access_token
                                    div_html += "<div class='d-flex justify-content-end mb-4'><div class='msg_img_cotainer_send'><img src=" + uri + " class='img-responsive msg_img' style= 'width:30%; height:20%'/><span class='msg_time_send'>" + response_json.datetime + "</span></div></div>"
                                }
                            })
                            self.messages.push(response_json.id)
                            $('#messgae_contant').append(div_html)
                            alert('Success: ' + response.json().id);
                        })
                        .catch(function(e) {
                            alert('Error: ' + e.message);
                        });
                } else {
                    alert('Error: Please Enter Number.')
                }
            } else {
                alert('You are not logged in in RingCentral. Please contact your Administrator.')
            }
        },
        do_recursive_alert: function() {
            var self = this;
            self.platform.get('/restapi/v1.0/account/~/extension/~/message-store?availability=Alive&direction=Inbound').then(function(msg_data) {
                    var messages = msg_data.json().records;
                    var rec_list = []
                    _.each(messages, function(message) {
                        if (self.messages.indexOf(message.id) == -1) {
                            rec_list.push(message)
                            Notification.requestPermission().then(function(result) {
                                new Notification('Hi, New Message Received')
                            });

                            if ($('#messgae_contant').length) {
                                var date = message.creationTime.split("T")
                                var time = date[1].split(".")
                                var datetime = date[0] + ' ' + time[0]
                                message.datetime = datetime
                                if (message.direction == "Inbound" && message.from.phoneNumber == self.title_popup) {
                                    var div_html = "<div class='d-flex justify-content-start mb-4'>" + "<div class='msg_cotainer_send'>" + message.subject + "<span class='msg_time'>" + message.datetime + "</span></div></div>"
                                    _.each(message.attachments, function(attachment) {
                                        if (attachment.type == 'MmsAttachment') {
                                            var uri = attachment.uri + '?access_token=' + self.access_token
                                            div_html += "<div class='d-flex justify-content-start mb-4'><div class='msg_img_cotainer'><img src=" + uri + " class='img-responsive msg_img' style= 'width:30%; height:20%'/><span class='msg_time'>" + message.datetime + "</span></div></div>"
                                        }
                                    })
                                    $('#messgae_contant').append(div_html)
                                    self.messages.push(message.id)
                                } else if (message.direction == "Outbound") {
                                    _.each(message.to, function(to_phone_umber) {
                                        if (to_phone_umber.phoneNumber == self.title_popup) {
                                            var div_html = "<div class='d-flex justify-content-end mb-4'>" + "<div class='msg_cotainer_send'>" + message.subject + "<span class='msg_time_send'>" + message.datetime + "</span></div></div>"
                                            _.each(message.attachments, function(attachment) {
                                                if (attachment.type == 'MmsAttachment') {
                                                    var uri = attachment.uri + '?access_token=' + self.access_token
                                                    div_html += "<div class='d-flex justify-content-end mb-4'><div class='msg_img_cotainer_send'><img src=" + uri + " class='img-responsive msg_img' style= 'width:30%; height:20%'/><span class='msg_time_send'>" + message.datetime + "</span></div></div>"
                                                }
                                            })
                                            $('#messgae_contant').append(div_html)
                                            self.messages.push(message.id)
                                        }
                                    })

                                }
                            }
                        }
                    })
                    if (rec_list.length > 0) {
                        rpc.query({
                            model: 'crm.phonecall',
                            method: 'create_message',
                            args: [rec_list]
                        })
                    }
                })
                // }
            setTimeout(function() {
                self.do_recursive_alert()
            }, 10000)
        },
        capitalizeFirstLetter: function(string) {
            var name = string.trim().split(' ')
            var firstName = name.slice(0, -1).join(' ');
            var lastName = name.slice(-1).join(' ');
            return (firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()) + ' ' + (lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase())
        }
    })

    $.widget("custom.combobox", {
        _create: function() {
            this.wrapper = $("<span>")
                .addClass("custom-combobox")
                .insertAfter(this.element);

            this.element.hide();
            this._createAutocomplete();
            this._createShowAllButton();
        },

        _createAutocomplete: function() {
            var selected = this.element.children(":selected"),
                value = selected.val() ? selected.text() : "";

            this.input = $("<input>")
                .appendTo(this.wrapper)
                .val(value)
                .attr("title", "")
                .addClass("custom-combobox-input form-control ui-widget ui-widget-content ui-state-default ui-corner-left")
                .autocomplete({
                    delay: 0,
                    minLength: 0,
                    source: $.proxy(this, "_source")
                })
                .tooltip({
                    classes: {
                        "ui-tooltip": "ui-state-highlight"
                    }
                });

            // this._on(this.input, {
            //     autocompleteselect: function(event, ui) {
            //         ui.item.option.selected = true;
            //         this._trigger("select", event, {
            //             item: ui.item.option
            //         });
            //     },
            // });
        },

        _createShowAllButton: function() {
            var input = this.input,
                wasOpen = false;

            $("<a>")
                .attr("tabIndex", -1)
                .attr("title", "Show All Items")
                .tooltip()
                .appendTo(this.wrapper)
                .button({
                    icons: {
                        primary: "ui-icon-triangle-1-s"
                    },
                    text: false
                })
                .removeClass("ui-corner-all")
                .addClass("custom-combobox-toggle ui-corner-right d-none")
                .on("mousedown", function() {
                    wasOpen = input.autocomplete("widget").is(":visible");
                })
                .on("click", function() {
                    input.trigger("focus");

                    // Close if already visible
                    if (wasOpen) {
                        return;
                    }

                    // Pass empty string as value to search for, displaying all results
                    input.autocomplete("search", "");
                });
        },

        _source: function(request, response) {
            var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), "i");
            var self = this;
            this.compate_partner = []
            this.length = 0
            var count = 0
            var option = this.element.children("option")
            for (var i = 0; i < option.length; i++) {
                count += 1
                var text = $(option[i]).text();
                if (this.length >= 15) {
                    break;
                }
                if (this.length < 15 && option[i].value && (!request.term || matcher.test(text))) {
                    this.length += 1;
                    this.compate_partner.push(option[i])
                }
            }
            response(this.compate_partner)
        },

        _removeIfInvalid: function(event, ui) {

            // Selected an item, nothing to do
            if (ui.item) {
                return;
            }

            // Search for a match (case-insensitive)
            var value = this.input.val(),
                valueLowerCase = value.toLowerCase(),
                valid = false;
            this.element.children("option").each(function() {
                if ($(this).text().toLowerCase() === valueLowerCase) {
                    this.selected = valid = true;
                    return false;
                }
            });

            // Found a match, nothing to do
            if (valid) {
                return;
            }

            // Remove invalid value
            this.input
                .val("")
                .attr("title", value + " didn't match any item")
                .tooltip("open");
            this.element.val("");
            this._delay(function() {
                this.input.tooltip("close").attr("title", "");
            }, 2500);
            this.input.autocomplete("instance").term = "";
        },

        _destroy: function() {
            this.wrapper.remove();
            this.element.show();
        }
    });

    return {
        ringcentralPanel: new ringcentralPanel(),
    };

})
