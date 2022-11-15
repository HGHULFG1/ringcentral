# See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class RingcentralController(http.Controller):
    @http.route("/ringcentral_credentials", type="json", auth="user")
    def ringcentral_credentials(self, **kw):
        company = request.env["res.company"].sudo().browse(kw.get("company_id"))
        base_url = request.env["ir.config_parameter"].sudo().get_param("web.base.url")
        contacts_action_id = request.env.ref("contacts.action_contacts").id
        return {
            "ringcentral_app_host": company.ringcentral_app_host,
            "ringcentral_app_port": company.ringcentral_app_port,
            "ringcentral_redirect_uri": company.ringcentral_redirect_uri,
            "ringcentral_server": company.ringcentral_server,
            "ringcentral_app_key": company.ringcentral_app_key,
            "ringcentral_app_secret": company.ringcentral_app_secret,
            "ringcentral_service_uri": company.ringcentral_service_uri,
            "ringcentral_base_url": base_url,
            "contacts_action": str(contacts_action_id),
        }
