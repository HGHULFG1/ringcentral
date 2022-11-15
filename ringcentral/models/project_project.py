# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProjectProject(models.Model):
    _inherit = "project.project"

    phonecall_about_id = fields.Many2one("crm.phonecall.about", "Phonecall About")
