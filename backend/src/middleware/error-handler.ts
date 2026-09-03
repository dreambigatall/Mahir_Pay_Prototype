import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";

export const notFoundHandler:RequestHandler=(request,_response,next)=>next(new AppError(404,"ROUTE_NOT_FOUND",`No route for ${request.method} ${request.path}`));

export const errorHandler:ErrorRequestHandler=(error,request,response,_next)=>{
  if(error instanceof ZodError){response.status(400).json({error:{code:"VALIDATION_ERROR",message:"Request validation failed",details:error.flatten(),requestId:request.requestId}});return;}
  if(error instanceof AppError){response.status(error.status).json({error:{code:error.code,message:error.message,...(error.details===undefined?{}:{details:error.details}),requestId:request.requestId}});return;}
  const databaseError=postgresError(error);
  if(databaseError){response.status(databaseError.status).json({error:{code:databaseError.code,message:databaseError.message,requestId:request.requestId}});return;}
  console.error("Unhandled request error",{requestId:request.requestId,error});
  response.status(500).json({error:{code:"INTERNAL_SERVER_ERROR",message:"An unexpected error occurred",requestId:request.requestId}});
};

function postgresError(error:unknown):{status:number;code:string;message:string}|null{
  if(typeof error!=="object"||error===null||!("code" in error))return null;
  const code=String(error.code);
  if(code==="23505")return{status:409,code:"RESOURCE_CONFLICT",message:"A conflicting record already exists"};
  if(code==="23503")return{status:409,code:"REFERENCE_CONFLICT",message:"The operation conflicts with a related record"};
  if(code==="23514")return{status:409,code:"WORKFLOW_CONSTRAINT",message:"The operation violates a workflow or data constraint"};
  if(code==="22P02")return{status:400,code:"VALUE_INVALID",message:"A supplied value has an invalid format"};
  if(code==="42P08")return{status:400,code:"VALUE_INVALID",message:"A supplied value has an invalid format"};
  return null;
}
