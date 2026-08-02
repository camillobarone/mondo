"""Estrae il registro dei nodi ComfyUI dal sorgente, senza importare torch.

Serve a validare i grafi generati da `mondo_image.graphs` contro i nodi che
ComfyUI espone davvero, invece di fidarsi della memoria. Produce lo snapshot
`tests/comfy_registry.json`.

Uso:
    python tools/extract_comfy_registry.py /percorso/a/ComfyUI tests/comfy_registry.json

ComfyUI definisce i nodi in due modi, entrambi gestiti qui:
  - legacy: `INPUT_TYPES()` + `NODE_CLASS_MAPPINGS`
  - schema V3: `define_schema()` -> `io.Schema(node_id=..., inputs=[...])`
"""

from __future__ import annotations

import ast
import glob
import json
import os
import sys


def _literal(node: ast.AST):
    try:
        return ast.literal_eval(node)
    except Exception:
        return None


def _legacy_inputs(cls: ast.ClassDef) -> dict:
    """Legge INPUT_TYPES(). `spread` segnala un `**base` non risolvibile staticamente."""
    for item in cls.body:
        if not (isinstance(item, ast.FunctionDef) and item.name == "INPUT_TYPES"):
            continue
        for stmt in ast.walk(item):
            if not (isinstance(stmt, ast.Return) and isinstance(stmt.value, ast.Dict)):
                continue
            out = {"required": [], "optional": [], "spread": False}
            for key, value in zip(stmt.value.keys, stmt.value.values):
                section = _literal(key)
                if section not in ("required", "optional") or not isinstance(value, ast.Dict):
                    continue
                # `{**types["required"], "channel": ...}` -> chiave None per lo spread.
                if any(k is None for k in value.keys):
                    out["spread"] = True
                out[section] = [
                    n for n in (_literal(k) for k in value.keys) if isinstance(n, str)
                ]
            if out["required"] or out["optional"]:
                return out
    return {"required": [], "optional": [], "spread": True}


def _v3_schema(cls: ast.ClassDef):
    """Legge define_schema() -> io.Schema(node_id=..., inputs=[io.Tipo.Input("nome")])."""
    for item in cls.body:
        if not (isinstance(item, ast.FunctionDef) and item.name == "define_schema"):
            continue
        for stmt in ast.walk(item):
            if not (
                isinstance(stmt, ast.Call)
                and isinstance(stmt.func, ast.Attribute)
                and stmt.func.attr == "Schema"
            ):
                continue
            node_id = None
            inputs = {"required": [], "optional": [], "spread": False}
            for kw in stmt.keywords:
                if kw.arg == "node_id":
                    node_id = _literal(kw.value)
                elif kw.arg == "inputs" and isinstance(kw.value, ast.List):
                    for element in kw.value.elts:
                        if not (
                            isinstance(element, ast.Call)
                            and isinstance(element.func, ast.Attribute)
                            and element.func.attr == "Input"
                        ):
                            inputs["spread"] = True  # forma non riconosciuta: non bloccare
                            continue
                        name = _literal(element.args[0]) if element.args else None
                        if name is None:
                            name = next(
                                (_literal(k.value) for k in element.keywords if k.arg == "id"),
                                None,
                            )
                        if not isinstance(name, str):
                            continue
                        optional = any(
                            k.arg == "optional" and _literal(k.value) is True
                            for k in element.keywords
                        )
                        inputs["optional" if optional else "required"].append(name)
            if node_id:
                return node_id, inputs
    return None, None


def _enum_list(tree: ast.Module, name: str) -> list[str]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == name for t in node.targets
        ):
            value = _literal(node.value)
            if isinstance(value, list):
                return [v for v in value if isinstance(v, str)]
    return []


def _dict_keys(tree: ast.Module, name: str) -> list[str]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == name for t in node.targets
        ):
            if isinstance(node.value, ast.Dict):
                return [k for k in (_literal(x) for x in node.value.keys) if isinstance(k, str)]
    return []


def extract(comfy_root: str) -> dict:
    nodes: dict[str, dict] = {}
    sources = [os.path.join(comfy_root, "nodes.py")] + sorted(
        glob.glob(os.path.join(comfy_root, "comfy_extras", "nodes_*.py"))
    )
    for path in sources:
        if not os.path.exists(path):
            continue
        try:
            tree = ast.parse(open(path, encoding="utf-8").read())
        except (SyntaxError, UnicodeDecodeError):
            continue
        classes = {n.name: n for n in tree.body if isinstance(n, ast.ClassDef)}
        for cls in classes.values():
            node_id, inputs = _v3_schema(cls)
            if node_id:
                nodes[node_id] = inputs
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict)):
                continue
            if not any(
                isinstance(t, ast.Name) and t.id == "NODE_CLASS_MAPPINGS" for t in node.targets
            ):
                continue
            for key, value in zip(node.value.keys, node.value.values):
                node_id = _literal(key)
                class_name = value.id if isinstance(value, ast.Name) else None
                if isinstance(node_id, str) and class_name in classes:
                    nodes[node_id] = _legacy_inputs(classes[class_name])

    samplers = ast.parse(open(os.path.join(comfy_root, "comfy", "samplers.py"), encoding="utf-8").read())
    control_types = ast.parse(
        open(os.path.join(comfy_root, "comfy", "cldm", "control_types.py"), encoding="utf-8").read()
    )
    return {
        "nodes": nodes,
        "samplers": _enum_list(samplers, "KSAMPLER_NAMES") + ["ddim", "uni_pc", "uni_pc_bh2"],
        "schedulers": _dict_keys(samplers, "SCHEDULER_HANDLERS"),
        "union_controlnet_types": ["auto"] + _dict_keys(control_types, "UNION_CONTROLNET_TYPES"),
    }


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    registry = extract(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        json.dump(registry, fh, indent=1, sort_keys=True)
    print(
        f"nodi: {len(registry['nodes'])}  sampler: {len(registry['samplers'])}  "
        f"scheduler: {len(registry['schedulers'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
