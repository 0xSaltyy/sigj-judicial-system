"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TreeNode={id:string;parentId:string|null;name:string;type:string;code:string;level:number};
type TreeMember={id:string;name:string;title:string;nodeId:string};

export function InstitutionalTree({nodes,members,canEdit,canViewUsers}:{nodes:TreeNode[];members:TreeMember[];canEdit:boolean;canViewUsers:boolean}) {
  const roots=useMemo(()=>{const ids=new Set(nodes.map((item)=>item.id));return nodes.filter((item)=>!item.parentId||!ids.has(item.parentId));},[nodes]);
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set(roots.map((item)=>item.id)));
  const [query,setQuery]=useState("");
  const normalized=query.trim().toLocaleLowerCase("es");
  const childrenByParent=useMemo(()=>{const map=new Map<string,TreeNode[]>();for(const item of nodes){if(!item.parentId)continue;map.set(item.parentId,[...(map.get(item.parentId)??[]),item]);}return map;},[nodes]);
  const membersByNode=useMemo(()=>{const map=new Map<string,TreeMember[]>();for(const item of members)map.set(item.nodeId,[...(map.get(item.nodeId)??[]),item]);return map;},[members]);
  const matches=(node:TreeNode):boolean=>{
    const own=`${node.name} ${node.type} ${node.code} ${(membersByNode.get(node.id)??[]).map((item)=>`${item.name} ${item.title}`).join(" ")}`.toLocaleLowerCase("es").includes(normalized);
    return !normalized||own||(childrenByParent.get(node.id)??[]).some(matches);
  };
  const toggle=(id:string)=>setExpanded((current)=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  if(!nodes.length)return <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-white p-8 text-center"><div><Building2 className="mx-auto size-10 text-slate-400"/><p className="mt-3 font-semibold">Sin nodos institucionales disponibles</p><p className="mt-1 text-sm text-muted-foreground">No existen dependencias dentro de su alcance actual.</p></div></div>;
  return <section className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-lg"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar institución, despacho, código o miembro…" aria-label="Buscar en el árbol institucional" className="pl-9"/></div>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>setExpanded(new Set(nodes.map((item)=>item.id)))}>Expandir todo</Button><Button type="button" size="sm" variant="outline" onClick={()=>setExpanded(new Set())}>Contraer todo</Button></div>
    </div>
    <div className="space-y-3">{roots.filter(matches).map((node)=><TreeBranch key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} queryActive={Boolean(normalized)} matches={matches} childrenByParent={childrenByParent} membersByNode={membersByNode} canEdit={canEdit} canViewUsers={canViewUsers}/>)}</div>
    {normalized&&!roots.some(matches)&&<p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">No hay instituciones, dependencias o miembros que coincidan con la búsqueda.</p>}
  </section>;
}

function TreeBranch({node,depth,expanded,toggle,queryActive,matches,childrenByParent,membersByNode,canEdit,canViewUsers}:{node:TreeNode;depth:number;expanded:Set<string>;toggle:(id:string)=>void;queryActive:boolean;matches:(node:TreeNode)=>boolean;childrenByParent:Map<string,TreeNode[]>;membersByNode:Map<string,TreeMember[]>;canEdit:boolean;canViewUsers:boolean}) {
  const children=(childrenByParent.get(node.id)??[]).filter(matches);
  const nodeMembers=membersByNode.get(node.id)??[];
  const open=queryActive||expanded.has(node.id);
  return <div className="tree-row-enter min-w-0 rounded-xl border bg-white shadow-sm" style={{marginLeft:`${Math.min(depth,4)*12}px`}}>
    <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <button type="button" onClick={()=>toggle(node.id)} className="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 hover:bg-slate-50" aria-expanded={open} aria-label={`${open?"Contraer":"Expandir"} ${node.name}`}><ChevronRight className={`size-4 transition-transform duration-200 ${open?"rotate-90":""}`}/></button>
      <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><Link href={`/admin/dependencias/${node.id}`} className="min-w-0 break-words font-semibold text-[#153553] hover:underline">{node.name}</Link><Badge variant="outline">{node.type}</Badge><Badge>{node.code}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{children.length} subdependencia{children.length===1?"":"s"} · {nodeMembers.length} miembro{nodeMembers.length===1?"":"s"}</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/admin/dependencias/${node.id}`}>Abrir panel</Link></Button>{canEdit&&<Button asChild size="sm" variant="ghost"><Link href="/admin/dependencias">Editar estructura</Link></Button>}</div>
    </div>
    {open&&<div className="border-t bg-slate-50/50 p-3 sm:p-4">
      {nodeMembers.length>0&&<div className="mb-3 flex min-w-0 flex-wrap gap-2">{nodeMembers.slice(0,6).map((member)=><div key={member.id} className="flex max-w-full min-w-0 items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#173b5e] text-[10px] font-bold text-white">{initials(member.name)}</span><span className="min-w-0"><span className="block max-w-48 truncate text-xs font-medium">{member.name}</span><span className="block max-w-48 truncate text-[10px] text-muted-foreground">{member.title}</span></span></div>)}{nodeMembers.length>6&&<Badge variant="outline">+{nodeMembers.length-6} miembros</Badge>}{canViewUsers&&<Link href="/admin/usuarios" className="inline-flex items-center gap-1 text-xs font-semibold text-[#153553] hover:underline"><Users className="size-3.5"/> Ver directorio</Link>}</div>}
      <div className="space-y-3">{children.map((child)=><TreeBranch key={child.id} node={child} depth={depth+1} expanded={expanded} toggle={toggle} queryActive={queryActive} matches={matches} childrenByParent={childrenByParent} membersByNode={membersByNode} canEdit={canEdit} canViewUsers={canViewUsers}/>)}</div>
      {!children.length&&!nodeMembers.length&&<p className="text-xs text-muted-foreground">Sin subdependencias ni miembros asignados.</p>}
    </div>}
  </div>;
}

function initials(name:string){return name.split(/\s+/).slice(0,2).map((part)=>part[0]??"").join("").toUpperCase();}
