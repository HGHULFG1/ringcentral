# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    ringcentral_server = fields.Char(
        "Ringcentral Server", help="Use ringcentral API server URL"
    )
    ringcentral_app_key = fields.Char(
        "Ringcentral App Key", help="Use ringcentral client ID"
    )
    ringcentral_app_secret = fields.Char(
        "Ringcentral App Secret", help="Use ringcentral client secret"
    )
    ringcentral_redirect_uri = fields.Char(
        "Ringcentral Redirect URI", help="Use current ODOO URL"
    )
    ringcentral_service_uri = fields.Char(
        "Ringcentral Service URI",
        help="Use ringcentral online portal",
        default="https://service.devtest.ringcentral.com/login/main.asp",
    )
    ringcentral_app_host = fields.Char(
        "Ringcentral Host",
        help="Use ringcentral API server URL with out using protocol.",
    )
    ringcentral_app_port = fields.Char("Ringcentral Port", help="Use current odoo Port")
