import * as ExcelJS from 'exceljs';

export type ParsedImportRow={row:number;data:Record<string,unknown>};
const MAX_ROWS=50_000,MAX_COLUMNS=100,MAX_CELL_CHARS=2_000;
const aliases:Record<string,string>={
 firstname:'firstName',first:'firstName',givenname:'firstName',name:'firstName',lastname:'lastName',surname:'lastName',familyname:'lastName',
 email:'email',emailaddress:'email',phone:'phone',mobile:'phone',mobilenumber:'phone',dateofbirth:'dateOfBirth',dob:'dateOfBirth',gender:'gender',
 admissionno:'admissionNo',admissionnumber:'admissionNo',rollno:'rollNo',rollnumber:'rollNo',classname:'className',class:'className',sectionname:'sectionName',section:'sectionName',admissiondate:'admissionDate',lifecycle:'lifecycle',status:'status',
 employeeno:'employeeNo',employeenumber:'employeeNo',staffid:'employeeNo',department:'department',qualification:'qualification',joiningdate:'joiningDate',dateofjoining:'joiningDate'
};
const normalizeHeader=(value:unknown)=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function canonicalHeaders(values:unknown[]){
 if(values.length>MAX_COLUMNS)throw new Error(`Import has more than ${MAX_COLUMNS} columns`);
 const used=new Set<string>();return values.map((value,index)=>{const normalized=normalizeHeader(value);if(!normalized)return'';const key=aliases[normalized]||String(value).trim().replace(/\s+/g,'').replace(/^./,c=>c.toLowerCase()).slice(0,80);if(used.has(key))throw new Error(`Duplicate import column: ${key}`);used.add(key);return key||`column${index+1}`});
}
function safeCell(value:unknown):unknown{
 if(value===null||value===undefined)return'';
 if(value instanceof Date)return value.toISOString();
 if(typeof value==='number'||typeof value==='boolean')return value;
 if(typeof value==='object'){
  const object=value as any;
  if(Array.isArray(object.richText))value=object.richText.map((part:any)=>String(part?.text||'')).join('');
  else if('result'in object)value=object.result??'';
  else if('text'in object)value=object.text??'';
  else value='';
 }
 const text=String(value).normalize('NFKC').trim();if(text.length>MAX_CELL_CHARS)throw new Error(`Cell value exceeds ${MAX_CELL_CHARS} characters`);return text;
}
function mapRow(headers:string[],values:unknown[],row:number):ParsedImportRow|null{const data:Record<string,unknown>={};let hasValue=false;headers.forEach((key,index)=>{if(!key)return;const value=safeCell(values[index]);if(value!==''&&value!==undefined&&value!==null)hasValue=true;data[key]=value});return hasValue?{row,data}:null}

function parseCsvMatrix(input:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const char=input[i];if(quoted){if(char==='"'){if(input[i+1]==='"'){cell+='"';i++}else quoted=false}else cell+=char;continue}if(char==='"'&&cell===''){quoted=true;continue}if(char===','){row.push(cell);cell='';continue}if(char==='\n'||char==='\r'){if(char==='\r'&&input[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(value=>value.length))rows.push(row);row=[];if(rows.length>MAX_ROWS+1)throw new Error(`Import exceeds ${MAX_ROWS} data rows`);continue}cell+=char}if(quoted)throw new Error('CSV contains an unterminated quoted field');row.push(cell);if(row.some(value=>value.length))rows.push(row);if(rows.length<2)return rows;if(rows.length-1>MAX_ROWS)throw new Error(`Import exceeds ${MAX_ROWS} data rows`);return rows;
}

export async function parseImportFile(bytes:Buffer,contentType:string):Promise<ParsedImportRow[]>{
 if(contentType==='text/csv'){
  const text=bytes.toString('utf8').replace(/^\uFEFF/,'');const matrix=parseCsvMatrix(text);if(!matrix.length)throw new Error('Import file is empty');const headers=canonicalHeaders(matrix[0]);if(!headers.some(Boolean))throw new Error('Import file has no usable headers');return matrix.slice(1).map((values,index)=>mapRow(headers,values,index+2)).filter(Boolean) as ParsedImportRow[];
 }
 if(contentType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as any);const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Workbook has no worksheet');if(sheet.actualRowCount-1>MAX_ROWS)throw new Error(`Import exceeds ${MAX_ROWS} data rows`);if(sheet.actualColumnCount>MAX_COLUMNS)throw new Error(`Import has more than ${MAX_COLUMNS} columns`);
  const headerValues=(sheet.getRow(1).values as any[]).slice(1);const headers=canonicalHeaders(headerValues);if(!headers.some(Boolean))throw new Error('Import file has no usable headers');const rows:ParsedImportRow[]=[];sheet.eachRow({includeEmpty:false},(worksheetRow,rowNumber)=>{if(rowNumber===1)return;const values=(worksheetRow.values as any[]).slice(1);const mapped=mapRow(headers,values,rowNumber);if(mapped)rows.push(mapped)});return rows;
 }
 throw new Error('Unsupported import content type');
}
