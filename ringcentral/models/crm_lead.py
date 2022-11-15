# See LICENSE file for full copyright and licensing details.

from odoo import models


class crm_lead(models.Model):
    _inherit = "crm.lead"

    def schedule_appointment(self):
        context = self.env.context.copy()
        context.update({"default_lead_id": self.id})
        course_form = self.env.ref("calendar.view_calendar_event_form", False)
        return {
            "name": "New Appointment",
            "type": "ir.actions.act_window",
            "res_model": "calendar.event",
            "flags": {"form": {"action_buttons": True, "options": {"mode": "edit"}}},
            "view_id": course_form.id,
            "view_mode": "form",
            "target": "new",
            "context": context,
        }
