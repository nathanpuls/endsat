"""Generate a receiver source plist, with no embedded credentials or contacts."""
import json, pathlib, plistlib, subprocess, uuid
root = pathlib.Path(__file__).resolve().parents[1]
registry = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {DROP_ACTIONS} from './drop.js'; console.log(JSON.stringify(DROP_ACTIONS));"],cwd=root))
first = next(a for a in registry if a['enabled'])
actions=[]
def action(name, **params):
    ident=str(uuid.uuid4()).upper()
    actions.append({'WFWorkflowActionIdentifier':'is.workflow.actions.'+name,'WFWorkflowActionParameters':{'UUID':ident,**params}})
    return {'Type':'ActionOutput','OutputUUID':ident,'OutputName':params.get('CustomOutputName','Result')}
def text(s, attachments=None):
    return {'Value':{'string':s,'attachmentsByRange':attachments or {}},'WFSerializationType':'WFTextTokenString'}
def attachment(ref):
    return {'Value':ref,'WFSerializationType':'WFTextTokenAttachment'}
def templ(prefix,ref,suffix=''):
    return text(prefix+'\ufffc'+suffix,{'{%d, 1}'%len(prefix):ref})
def dictionary(items):
    return {'Value':{'WFDictionaryFieldValueItems':[{'WFItemType':0,'WFKey':text(k),'WFValue':v if isinstance(v,dict) else text(v)} for k,v in items.items()]},'WFSerializationType':'WFDictionaryFieldValue'}
def value(key, ref):
    return action('getvalueforkey',WFDictionaryKey=key,WFInput=attachment(ref),WFGetDictionaryValueType='Value',CustomOutputName=key)
key=action('gettext',WFTextActionText='PASTE YOUR DROP KEY HERE',CustomOutputName='Drop key')
headers=dictionary({'Authorization':templ('Bearer ',key),'Content-Type':'application/json'})
response=action('downloadurl',WFURL=text('https://ends.at/api/drop/next'),WFHTTPMethod='POST',ShowHeaders=True,WFHTTPHeaders=headers,WFHTTPBodyType='JSON',WFJSONValues=dictionary({}),CustomOutputName='Drop response')
job=value('job',response)
group=str(uuid.uuid4()).upper()
action('conditional',WFControlFlowMode=0,GroupingIdentifier=group,WFCondition=1001,WFInput={'Type':'Variable','Variable':attachment(job)})
job_id=value('id',job)
receipt=value('receipt',job)
payload=value('text',job)
name=value('shortcut',job)
# The sole enabled action comes from the server's central registry.
# An explicit allowlist gate also prevents this receiver invoking unexpected shortcuts.
gate=str(uuid.uuid4()).upper()
action('conditional',WFControlFlowMode=0,GroupingIdentifier=gate,WFCondition=0,WFInput={'Type':'Variable','Variable':attachment(name)},WFConditionalActionString=first['shortcut'])
action('runworkflow',WFWorkflowName=first['shortcut'],WFInput=attachment(payload))
action('downloadurl',WFURL=templ('https://ends.at/api/drop/jobs/',job_id,'/complete'),WFHTTPMethod='POST',ShowHeaders=True,WFHTTPHeaders=headers,WFHTTPBodyType='JSON',WFJSONValues=dictionary({'receipt':templ('',receipt)}))
action('conditional',WFControlFlowMode=2,GroupingIdentifier=gate)
action('conditional',WFControlFlowMode=2,GroupingIdentifier=group)
workflow={'WFWorkflowName':'Drop Receiver','WFWorkflowActions':actions,'WFWorkflowClientVersion':'2700.0.4','WFWorkflowMinimumClientVersion':900,'WFWorkflowMinimumClientVersionString':'900','WFWorkflowIcon':{'WFWorkflowIconGlyphNumber':59511,'WFWorkflowIconStartColor':2846468607},'WFWorkflowInputContentItemClasses':['WFStringContentItem'],'WFWorkflowOutputContentItemClasses':[],'WFWorkflowTypes':[],'WFWorkflowHasOutputFallback':False,'WFWorkflowImportQuestions':[]}
dest=root/'shortcuts'/'Drop-Receiver.source.plist'
dest.write_bytes(plistlib.dumps(workflow,fmt=plistlib.FMT_XML,sort_keys=False))
print(str(dest))
