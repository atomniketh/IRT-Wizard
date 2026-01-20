import io
from typing import TYPE_CHECKING, Any

import numpy as np
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
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontSize=20,
            spaceAfter=20,
            alignment=1,
        )

        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontSize=12,
            spaceAfter=30,
            alignment=1,
            textColor=colors.grey,
        )

        if report_type == "summary":
            self._build_summary_report(analysis, story, styles, title_style, subtitle_style)
        else:
            self._build_detailed_report(analysis, story, styles, title_style, subtitle_style)

        doc.build(story)
        return output.getvalue()

    def _build_summary_report(self, analysis, story, styles, title_style, subtitle_style):
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

        story.append(Paragraph("IRT Analysis Summary Report", title_style))
        story.append(Paragraph(f"{analysis.name} | {analysis.model_type} Model", subtitle_style))
        story.append(Spacer(1, 0.25 * inch))

        story.append(Paragraph("Key Results", styles["Heading2"]))
        if analysis.model_fit:
            key_stats = [
                ["Metric", "Value"],
                ["Model", analysis.model_type],
                ["Items", str(analysis.model_fit.get("n_items", "N/A"))],
                ["Respondents", str(analysis.model_fit.get("n_persons", "N/A"))],
                ["AIC", f"{analysis.model_fit.get('aic', 0):.2f}"],
                ["BIC", f"{analysis.model_fit.get('bic', 0):.2f}"],
            ]

            table = Table(key_stats, colWidths=[2.5 * inch, 2 * inch])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("GRID", (0, 0), (-1, -1), 1, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            story.append(table)
            story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Item Parameters (Top 5)", styles["Heading2"]))
        if analysis.item_parameters:
            items = analysis.item_parameters.get("items", [])[:5]

            item_data = [["Item", "Difficulty (b)", "Discrimination (a)"]]
            for item in items:
                item_data.append([
                    item.get("name", ""),
                    f"{item.get('difficulty', 0):.3f}",
                    f"{item.get('discrimination', 1):.3f}",
                ])

            item_table = Table(item_data, colWidths=[2 * inch, 1.75 * inch, 1.75 * inch])
            item_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 1, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            story.append(item_table)

            total_items = len(analysis.item_parameters.get("items", []))
            if total_items > 5:
                story.append(Spacer(1, 0.1 * inch))
                story.append(Paragraph(
                    f"<i>Showing 5 of {total_items} items. See detailed report for complete list.</i>",
                    styles["Normal"]
                ))

        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph(
            "<i>This is a summary report. Generate a detailed report for complete analysis including "
            "all item parameters, ability estimates, and interpretation guidelines.</i>",
            styles["Normal"]
        ))

    def _build_detailed_report(self, analysis, story, styles, title_style, subtitle_style):
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import PageBreak, Paragraph, Spacer, Table, TableStyle

        story.append(Paragraph("IRT Analysis Detailed Report", title_style))
        story.append(Paragraph(f"{analysis.name}", subtitle_style))
        story.append(Spacer(1, 0.25 * inch))

        story.append(Paragraph("1. Analysis Overview", styles["Heading2"]))
        overview_text = f"""
        This report presents the results of an Item Response Theory (IRT) analysis using the
        <b>{analysis.model_type}</b> model. The analysis was conducted on a dataset containing
        {analysis.model_fit.get('n_items', 'N/A')} items and {analysis.model_fit.get('n_persons', 'N/A')} respondents.
        """
        story.append(Paragraph(overview_text, styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

        model_descriptions = {
            "1PL": "The One-Parameter Logistic (1PL/Rasch) model estimates only item difficulty, assuming equal discrimination across all items.",
            "2PL": "The Two-Parameter Logistic (2PL) model estimates both item difficulty and discrimination parameters.",
            "3PL": "The Three-Parameter Logistic (3PL) model adds a guessing parameter to account for correct responses due to chance.",
        }
        story.append(Paragraph(
            f"<b>Model Description:</b> {model_descriptions.get(analysis.model_type, '')}",
            styles["Normal"]
        ))
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("2. Model Fit Statistics", styles["Heading2"]))
        if analysis.model_fit:
            fit_data = [["Metric", "Value", "Interpretation"]]

            aic = analysis.model_fit.get('aic', 0)
            bic = analysis.model_fit.get('bic', 0)
            ll = analysis.model_fit.get('log_likelihood', 0)

            fit_data.append(["Log-Likelihood", f"{ll:.2f}", "Higher (less negative) is better"])
            fit_data.append(["AIC", f"{aic:.2f}", "Lower is better; penalizes complexity"])
            fit_data.append(["BIC", f"{bic:.2f}", "Lower is better; stronger complexity penalty"])
            fit_data.append(["N Parameters", str(analysis.model_fit.get('n_parameters', '')), ""])
            fit_data.append(["N Items", str(analysis.model_fit.get('n_items', '')), ""])
            fit_data.append(["N Persons", str(analysis.model_fit.get('n_persons', '')), ""])

            fit_table = Table(fit_data, colWidths=[1.5 * inch, 1.25 * inch, 2.75 * inch])
            fit_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (1, -1), "CENTER"),
                ("ALIGN", (2, 1), (2, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 1, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            story.append(fit_table)
        story.append(Spacer(1, 0.3 * inch))

        story.append(PageBreak())
        story.append(Paragraph("3. Item Parameters", styles["Heading2"]))

        param_explanation = """
        <b>Difficulty (b):</b> The ability level at which a respondent has a 50% chance of answering correctly.
        Higher values indicate harder items. Typical range: -3 to +3.<br/><br/>
        <b>Discrimination (a):</b> How well the item differentiates between respondents of different abilities.
        Higher values indicate better discrimination. Values below 0.5 suggest poor discrimination.
        """
        story.append(Paragraph(param_explanation, styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

        if analysis.item_parameters:
            items = analysis.item_parameters.get("items", [])

            item_data = [["Item", "Difficulty (b)", "Discrimination (a)", "Guessing (c)"]]
            for item in items:
                item_data.append([
                    item.get("name", ""),
                    f"{item.get('difficulty', 0):.3f}",
                    f"{item.get('discrimination', 1):.3f}",
                    f"{item.get('guessing', 0):.3f}",
                ])

            item_table = Table(item_data, colWidths=[1.75 * inch, 1.4 * inch, 1.5 * inch, 1.1 * inch])
            item_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 1, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            story.append(item_table)
        story.append(Spacer(1, 0.3 * inch))

        story.append(PageBreak())
        story.append(Paragraph("4. Ability Estimates Summary", styles["Heading2"]))
        if analysis.ability_estimates:
            persons = analysis.ability_estimates.get("persons", [])
            thetas = [p.get("theta", 0) for p in persons]

            summary_data = [
                ["Statistic", "Value"],
                ["N Respondents", str(len(thetas))],
                ["Mean Ability (θ)", f"{np.mean(thetas):.3f}"],
                ["Std. Deviation", f"{np.std(thetas):.3f}"],
                ["Minimum", f"{np.min(thetas):.3f}"],
                ["25th Percentile", f"{np.percentile(thetas, 25):.3f}"],
                ["Median", f"{np.median(thetas):.3f}"],
                ["75th Percentile", f"{np.percentile(thetas, 75):.3f}"],
                ["Maximum", f"{np.max(thetas):.3f}"],
            ]

            summary_table = Table(summary_data, colWidths=[2.5 * inch, 1.5 * inch])
            summary_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 1, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph(
                "<b>Interpretation:</b> Ability estimates (θ) are on a standardized scale centered around 0. "
                "Positive values indicate above-average ability, negative values indicate below-average ability.",
                styles["Normal"]
            ))
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("5. Interpretation Guidelines", styles["Heading2"]))
        guidelines = """
        <b>Item Difficulty:</b><br/>
        • b &lt; -2: Very easy item<br/>
        • -2 ≤ b &lt; -1: Easy item<br/>
        • -1 ≤ b ≤ 1: Moderate difficulty<br/>
        • 1 &lt; b ≤ 2: Difficult item<br/>
        • b &gt; 2: Very difficult item<br/><br/>

        <b>Item Discrimination:</b><br/>
        • a &lt; 0.5: Poor discrimination (consider revising)<br/>
        • 0.5 ≤ a &lt; 1.0: Low discrimination<br/>
        • 1.0 ≤ a &lt; 1.5: Moderate discrimination<br/>
        • 1.5 ≤ a &lt; 2.0: High discrimination<br/>
        • a ≥ 2.0: Very high discrimination<br/><br/>

        <b>Model Selection:</b><br/>
        Compare AIC and BIC values across different models. Lower values indicate better fit.
        BIC applies a stronger penalty for model complexity and is preferred for model selection.
        """
        story.append(Paragraph(guidelines, styles["Normal"]))
