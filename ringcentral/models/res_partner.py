# See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectProject(models.Model):
    _inherit = "res.partner"

    ringcentral_id = fields.Char("Ringcentral")
    extension_number = fields.Char('Extension Number')
    extension_id = fields.Char('Extension ID')

    @api.model
    def ac_search_read(self, records):
        rec_message = self.search([])
        rec_message_id = rec_message.mapped("ringcentral_id")
        for rec_vals in records:
            if not rec_vals.get("id") in rec_message_id:
                try:
                    vals = {
                        "ringcentral_id": rec_vals.get("id"),
                        "name": rec_vals.get("firstName"),
                        "phone": rec_vals.get("phone"),
                        "customer_rank": rec_vals.get("customer_rank"),
                        "supplier_rank": rec_vals.get("supplier_rank")
                    }
                    self.create(vals)
                except:
                    pass
        return rec_message_id

    @api.model
    def get_search_read(self):
        que = (
            "select id as id, name as name, "
            "phone as phone , mobile as mobile, customer_rank as customer_rank, supplier_rank as supplier_rank from "
            "res_partner where mobile != '0' or phone != '0'"
        )
        self._cr.execute(que)
        return self._cr.fetchall()


class ResUser(models.Model):
    _inherit = "res.users"

    ringcentral_access_token = fields.Char("Ringcentral Access Token")
