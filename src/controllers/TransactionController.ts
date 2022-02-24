import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  Delete,
} from '@nestjs/common'
import { JoiValidationPipe } from '../validation/JoiValidationPipe'
import { transactionSchema } from '../validation/transactionSchema'
import { Logger } from '@nestjs/common'
import { TransactionRequest } from '../requests/TransactionRequest'
import { TransactionStatusUpdateRequest } from '../requests/TransactionStatusUpdateRequest'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AccountService } from '../services/AccountService'
import { EthereumTransaction } from '../data/entities/EthereumTransaction'
import config from '../config'
import { TransactionService } from '../services/TransactionService'

require('dotenv').config()

export const VALID_HEALTHCHECK_MESSAGE = 'OK'

const updateTxStatuses = ['submitted', 'signed', 'aborted']

@ApiTags('Transaction')
@Controller('custodian')
export class TransactionController {
  constructor(
    private readonly logger: Logger,
    private accountService: AccountService,
    private transactionService: TransactionService,
  ) {}

  @Post(`transaction`)
  @HttpCode(200)
  @UsePipes(new JoiValidationPipe(transactionSchema))
  async createTransaction(@Body() request: TransactionRequest) {
    const ethereumAccount = await this.accountService.getAccount(request.accountId)
    return this.transactionService.createTransaction({
      abortedTimestamp: null,
      createdTimestamp: new Date(),
      data: request.data,
      ethereumAccount,
      failedTimestamp: null,
      failureReason: null,
      fees: null,
      from: ethereumAccount.address,
      gasLimit: request.gasLimit,
      gasPrice: request.gasPrice,
      maxFeePerGas: request.maxFeePerGas,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas, 
      gasUsed: null,
      minedTimestamp: null,
      network: null,
      nonce: null,
      signedRawTransaction: null,
      signedTimestamp: null,
      submittedTimestamp: null,
      to: request.to,
      transactionHash: null,
      transactionStatus: 'created',
      type: request.type,
      userId: config().userUuid,
      value: request.value,
    })
  }

  @Get(`transaction/:id`)
  @ApiOperation({ description: 'Get a single transaction by ID' })
  @HttpCode(200)
  async getTransaction(@Param('id') id: string) {
    return this.transactionService.getTransaction(id)
  }

  @Get(`transaction`)
  @ApiOperation({ description: 'Get a transactions filtered by statuses' })
  @ApiQuery({
    name: 'transactionStatuses',
    description: 'transaction statuses to filter by (comma separated)',
  })
  @HttpCode(200)
  async getTransactions(
    // Accepts a comma separated list
    @Query('transactionStatuses') transactionStatuses?: string,
  ) {
    return this.transactionService.getTransactions(transactionStatuses)
  }

  @Patch('transaction/:id')
  @ApiOperation({ description: 'Update the status of a transaction' })
  @HttpCode(200)
  async updateTransaction(
    @Param('id') id: string,
    @Body() request: TransactionStatusUpdateRequest,
  ): Promise<EthereumTransaction> {
    const tx = await this.transactionService.getTransaction(id)    
    if(!tx) throw new HttpException('No such transaction', 404)
    if(!updateTxStatuses.includes(request.transactionStatus))
      throw new HttpException(`Invalid status ${request.transactionStatus}`, 404)
    if(request.transactionStatus === 'submitted') {
      if(tx.transactionStatus !== 'signed')
        throw new HttpException(`Transaction must be signed first: current status ${tx.transactionStatus}`, 400)
      return this.transactionService.submitTransaction(tx)
    } else if  (request.transactionStatus === 'signed') {
      if(request.transactionStatus === tx.transactionStatus) 
        throw new HttpException('Transaction already signed! Current status: signed', 400)
      return this.transactionService.signTransaction(tx)
    }  else if  (request.transactionStatus === 'aborted') {
      return this.transactionService.abortTransaction(tx)
    }
  }

  @Delete('/transaction')
  @HttpCode(200)
  @ApiOperation({ description: 'Delete all transactions (debug use)' })
  async deleteAllTransactions() {
    return this.transactionService.deleteAllTransactions()
  }

  @Delete('/transaction/:id')
  @HttpCode(200)
  @ApiOperation({ description: 'Delete a transaction (debug use)' })
  async deleteTransaction(@Param('id') id: string) {
    return this.transactionService.deleteTransaction(id)
  }
}
