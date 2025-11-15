import os
from jinja2 import Environment, FileSystemLoader, select_autoescape

_env = Environment(
    loader=FileSystemLoader(os.path.dirname(__file__)),
    autoescape=select_autoescape(enabled_extensions=("jinja",)),
)

def render(template_name: str, **context) -> str:
    template = _env.get_template(template_name)
    return template.render(**context)


