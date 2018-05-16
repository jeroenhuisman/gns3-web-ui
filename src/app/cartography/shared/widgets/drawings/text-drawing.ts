import { SVGSelection } from "../../models/types";
import { TextElement } from "../../models/drawings/text-element";
import { Drawing } from "../../models/drawing";
import { SvgToDrawingConverter } from "../../../map/helpers/svg-to-drawing-converter";
import { DrawingElement } from "../../models/drawings/drawing-element";


export class TextDrawingWidget {
  public draw(view: SVGSelection) {
    const drawing = view
      .selectAll<SVGTextElement, TextElement>('text.text_element')
        .data((d: Drawing) => {
          const svgConverter = new SvgToDrawingConverter();
          const elements: DrawingElement[] = [];
          try {
            const element = svgConverter.convert(d.svg);
            elements.push(element);
          } catch (error) {
            console.log(`Cannot convert due to Error: '${error}'`);
          }
          return elements.filter((e: DrawingElement) => e instanceof TextElement);
        });

    const drawing_enter = drawing
      .enter()
        .append<SVGTextElement>('text')
        .attr('class', 'text_element noselect');

    const merge = drawing.merge(drawing_enter);

    merge
      .attr('style', (text: TextElement) => {
        const styles: string[] = [];
        if (text.font_family) {
          styles.push(`font-family: "${text.font_family}"`);
        }
        if (text.font_size) {
          styles.push(`font-size: ${text.font_size}pt`);
        }
        if (text.font_weight) {
          styles.push(`font-weight: ${text.font_weight}`);
        }
        return styles.join("; ");
      });

    const lines = merge.selectAll<SVGTSpanElement, string>('tspan')
      .data((text: TextElement) => {
        return text.text.split(/\r?\n/);
      });

    const lines_enter = lines
      .enter()
        .append<SVGTSpanElement>('tspan');

    const lines_merge = lines.merge(lines_enter);

    lines_merge
      .text((line) => line)
      .attr('x', 0)
      .attr("dy", (line, i) => i === 0 ? '0em' : '1.2em');

    lines
      .exit()
        .remove();

    drawing
      .exit()
        .remove();

  }
}
