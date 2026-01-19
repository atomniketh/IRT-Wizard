import io
from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from app.models.analysis import Analysis


class ExportService:
    def generate_csv(self, analysis: "Analysis") -> str:
        output = io.StringIO()

        output.write("# Item Parameters\n")
        if analysis.item_parameters:
            items = analysis.item_parameters.get("items", [])
            df_items = pd.DataFrame(items)
            df_items.to_csv(output, index=False)

        output.write("\n# Ability Estimates\n")
        if analysis.ability_estimates:
            persons = analysis.ability_estimates.get("persons", [])
            df_abilities = pd.DataFrame(persons)
            df_abilities.to_csv(output, index=False)

        output.write("\n# Model Fit Statistics\n")
        if analysis.model_fit:
            for key, value in analysis.model_fit.items():
                output.write(f"{key},{value}\n")

        return output.getvalue()

    def generate_excel(self, analysis: "Analysis") -> bytes:
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            if analysis.item_parameters:
                items = analysis.item_parameters.get("items", [])
                df_items = pd.DataFrame(items)
                df_items.to_excel(writer, sheet_name="Item Parameters", index=False)

            if analysis.ability_estimates:
                persons = analysis.ability_estimates.get("persons", [])
                df_abilities = pd.DataFrame(persons)
                df_abilities.to_excel(writer, sheet_name="Ability Estimates", index=False)

            if analysis.model_fit:
                df_fit = pd.DataFrame([analysis.model_fit])
                df_fit.to_excel(writer, sheet_name="Model Fit", index=False)

        return output.getvalue()

    def generate_pdf_report(self, analysis: "Analysis", report_type: str = "summary") -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontSize=18,
            spaceAfter=30,
        )

        story.append(Paragraph(f"IRT Analysis Report: {analysis.name}", title_style))
        story.append(Paragraph(f"Model Type: {analysis.model_type}", styles["Normal"]))
        story.append(Spacer(1, 0.25 * inch))

        story.append(Paragraph("Model Fit Statistics", styles["Heading2"]))
        if analysis.model_fit:
            fit_data = [["Metric", "Value"]]
            for key, value in analysis.model_fit.items():
                if isinstance(value, float):
                    fit_data.append([key, f"{value:.4f}"])
                else:
                    fit_data.append([key, str(value)])

            fit_table = Table(fit_data, colWidths=[2.5 * inch, 2 * inch])
            fit_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                ])
            )
            story.append(fit_table)
            story.append(Spacer(1, 0.25 * inch))

        story.append(Paragraph("Item Parameters", styles["Heading2"]))
        if analysis.item_parameters:
            items = analysis.item_parameters.get("items", [])

            if report_type == "summary" and len(items) > 10:
                items = items[:10]
                story.append(Paragraph("(Showing first 10 items)", styles["Italic"]))

            item_data = [["Item", "Difficulty", "Discrimination", "Guessing"]]
            for item in items:
                item_data.append([
                    item.get("name", ""),
                    f"{item.get('difficulty', 0):.3f}",
                    f"{item.get('discrimination', 1):.3f}",
                    f"{item.get('guessing', 0):.3f}",
                ])

            item_table = Table(item_data, colWidths=[1.5 * inch, 1.25 * inch, 1.5 * inch, 1 * inch])
            item_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                ])
            )
            story.append(item_table)
            story.append(Spacer(1, 0.25 * inch))

        if report_type == "detailed":
            story.append(Paragraph("Ability Estimates Summary", styles["Heading2"]))
            if analysis.ability_estimates:
                persons = analysis.ability_estimates.get("persons", [])
                thetas = [p.get("theta", 0) for p in persons]

                import numpy as np

                summary_data = [
                    ["Statistic", "Value"],
                    ["N", str(len(thetas))],
                    ["Mean", f"{np.mean(thetas):.3f}"],
                    ["Std Dev", f"{np.std(thetas):.3f}"],
                    ["Min", f"{np.min(thetas):.3f}"],
                    ["Max", f"{np.max(thetas):.3f}"],
                ]

                summary_table = Table(summary_data, colWidths=[2 * inch, 1.5 * inch])
                summary_table.setStyle(
                    TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("GRID", (0, 0), (-1, -1), 1, colors.black),
                    ])
                )
                story.append(summary_table)

        doc.build(story)
        return output.getvalue()
