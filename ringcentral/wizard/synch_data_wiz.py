import datetime
from datetime import date

import requests

from odoo import _, fields, models
from odoo.exceptions import UserError


class RingcentralSynch(models.TransientModel):
    _name = "ringcentral.synch"

    select_filter = fields.Selection(
        [("all", "All"), ("5", "5 Days"), ("10", "10 Days"), ("1", "Today")],
        default="all",
    )

    def create_filter(self):
        headers = {
            "accept": "application/json",
        }
        if self.env.user.ringcentral_access_token:
            headers["authorization"] = (
                "Bearer " + self.env.user.ringcentral_access_token
            )
        params = [
            ("view", "Detailed"),
            ("page", "1"),
            ("perPage", "10000"),
        ]
        today = date.today()
        rec_li = []
        if self.select_filter == "all":
            rec_li = [("dateFrom", "1990-06-01")]
        elif self.select_filter == "5":
            previous_date = today - datetime.timedelta(days=5)
            rec_li = [("dateFrom", str(previous_date))]
        elif self.select_filter == "10":
            previous_date = today - datetime.timedelta(days=10)
            rec_li = [("dateFrom", str(previous_date))]
        params += rec_li
        if self.env.user.company_id and self.env.user.company_id.ringcentral_server:
            response = requests.get(
                str(self.env.user.company_id.ringcentral_server)
                + "/restapi/v1.0/account/~/extension/~/call-log",
                headers=headers,
                params=tuple(params),
            )
            rec_dict = response.json()
            if not rec_dict.get("errorCode"):
                self.env["crm.phonecall"].synch_data(rec_dict.get("records"))
            else:
                raise UserError(_("Please log in RingCentral."))

            params = [
                ("page", "1"),
                ("perPage", "1000"),
            ]
            params += rec_li
            response = requests.get(
                str(self.env.user.company_id.ringcentral_server)
                + "/restapi/v1.0/account/~/extension/~/message-store",
                headers=headers,
                params=tuple(params),
            )
            rec_dict = response.json()
            if not rec_dict.get("errorCode"):
                self.env["crm.phonecall"].create_message(rec_dict.get("records"))
            else:
                raise UserError(_("Please log in RingCentral."))
