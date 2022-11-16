# See LICENSE file for full copyright and licensing details.
{
    # Module Info
    "name": "Odoo RingCentral Integration",
    "version": "15.0.1.0.1",
    "license": "LGPL-3",
    "category": "Customer Relationship Management",
    "summary": "This is the connector application for RingCentral integration",
    "description": """
		Odoo RingCentral Integration module allows you to make incoming and outgoing phone calls, managing messages and keep tracking phone call logs.
		Odoo RingCentral Integration
		Odoo RingCentral Connector
		ringcentral integrations
		ringcentral integrate in odoo
		odoo ringcentral
		ringcentral crm integration
		ringcentral app integration
		voip integration
		odoo voip integration
		odoo voip app
		voip odoo
		odoo voip module
		odoo email integration
		ringcentral integrations
		ringcentral crm
		ringcentral crm integration
		ringcentral app integration
		odoo voip integration
		odoo voip system
		odoo voip software
		voip system
		voip softwar
		odoo voip
		Voip
    """,

    # Author
    "author": "Serpent Consulting Services Pvt. Ltd.",
    "website": "https://www.serpentcs.com",

    # Dependencies
    "depends": ["crm", "sales_team", "project", "web", "account"],

    # Data
    "data": [
        "security/security.xml",
        "security/ir.model.access.csv",
        # "views/template.xml",
        "views/crm_phonecall_view.xml",
        "views/res_users_view.xml",
        "views/company_view.xml",
        "wizard/synch_data_wiz.xml",
    ],
    'assets': {
        'web.assets_qweb': [
            'ringcentral/static/src/xml/ringcentral.xml',
            'ringcentral/static/src/xml/widget.xml',
        ],
        'web.assets_backend': [
            '/ringcentral/static/src/lib/sip.js',
            '/ringcentral/static/src/lib/fetch.js',
            '/ringcentral/static/src/lib/promise.js',
            '/ringcentral/static/src/lib/pubnub.js',
            '/ringcentral/static/src/lib/ringcentral.js',
            '/ringcentral/static/src/lib/ringcentral-web-phone.js',
            '/ringcentral/static/src/lib/jquery.slidemenu.js',
            '/ringcentral/static/src/js/custom_ringcentral.js',
            '/ringcentral/static/src/lib/ringcentral_portal_login.js',
            '/ringcentral/static/src/lib/audio_field.js',
            '/ringcentral/static/src/scss/slidemenu.scss',
            '/ringcentral/static/src/css/ringcentral.css',
            '/ringcentral/static/src/scss/custom_ringcentral.scss',
        ],
    },

    # "qweb": ["static/src/xml/ringcentral.xml", "static/src/xml/widget.xml"],

    # Odoo App Store Specific
    "images": ["static/description/RingCentral_Banner.png"],
    "live_test_url": "https://www.youtube.com/watch?v=P_UnbQwf_So&list=PL4Wugt3LKrSQTcPoOEONX0wtc16xtEB1b",

    # Technical
    "installable": True,
    "application": True,
    "price": 599,
    "currency": "EUR",
}
