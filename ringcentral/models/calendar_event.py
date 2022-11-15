# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class CalendarEvents(models.Model):
    _inherit = "calendar.event"

    lead_id = fields.Many2one("crm.lead", string="Lead", readonly=True)
